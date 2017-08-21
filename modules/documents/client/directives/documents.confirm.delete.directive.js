'use strict';
angular.module('documents')
.directive('confirmDelete', ['ConfirmDeleteService', function (ConfirmDeleteService) {
	// x-confirm-delete
	return {
		restrict: 'A',
		scope: {
			files: '=',
			folders: '=',
			project: '=',
			successCallback: '=',
			errorCallback: '='
		},
		link: function (scope, element, attrs) {
			element.on('click', function () {
				ConfirmDeleteService.confirmDialog(scope);
			});
		}
	};
}])
.service('ConfirmDeleteService', ['$rootScope', '$modal', '_', '$timeout', 'DeleteService', 'AlertService', function ($rootScope, $modal, _, $timeout, DeleteService, AlertService) {
	var service = this;
	service.confirmDialog = function(scope) {
		return new Promise(function(fulfill, reject) {
			var modal = $modal.open({
				animation: true,
				templateUrl: 'modules/documents/client/views/partials/modal-document-confirm-delete.html',
				resolve: {},
				controllerAs: 'confirmDlg',
				controller: function ($scope, $modalInstance) {
					var self = this;
					self.busy = true;

					console.log(' $scope',  $scope);
					// TODO  remove this before PR.
					var fakeChildren = false;

					/*
						To test the server side delete API and make sure that it does not allow deletion of folders or
						files that fail the "can delete" test ... set the following to true.  This will bypass the
						client side tests and send all selected files or folders.
						This is also a good way to test the client side error handling.
					 */
					self.testServerAPI = false;

					self.project = scope.project;
					self.successCallback = scope.successCallback;
					self.errorCallback = scope.errorCallback;
					self.submit = submit;
					self.cancel = cancel;
					init();

					// collect deletable folders and files
					// caller may have batch or single file
					function collect(items) {
						if (!items ) {
							return [];
						}
						var items = Array.isArray(items) ? items : [ items ];
						var results = _.map(items).map(function(item) {
							var fClone = _.clone(item);
							if (fClone.type === 'File') {
								fClone.userCanPublish = item.userCan.publish;
								// file properties are already in place  f.isPublished and f.displayName
								fClone.hasChildren = false;
								fClone.type = ['png','jpg','jpeg'].includes(fClone.internalExt) ? 'Picture' : 'File';
							} else {
								fClone.userCanPublish = item.model.folderObj.userCan.publish;
								fClone.hasChildren = fakeChildren; // TODO  implement check for children.
								fClone.isPublished = item.model.published;
								fClone.displayName = item.model.name;
								fClone.type = 'Folder';							}
							fClone.canBeDeleted = fClone.userCanPublish && !fClone.isPublished && !fClone.hasChildren;
							if (!fClone.canBeDeleted) {
								fClone.reason = (
										!fClone.userCanPublish ? "Not authorized to delete" :
										fClone.isPublished ? "Published content can't be deleted" :
										fClone.hasChildren ? "Folders with content can't be deleted" : ""
								);
							}
							return fClone;
						});
						return results;
					}
					function init() {
						self.folders = collect(scope.folders);
						self.files = collect(scope.files);
						self.deletableFolders = _.filter(self.folders, function (item) {
							return item.canBeDeleted;
						});
						self.deletableFiles = _.filter(self.files, function (item) {
							return item.canBeDeleted;
						});
						// the combined list is used by the ng-repeat
						self.combindedList = self.folders.concat(self.files);
						var folderCnt = self.deletableFolders.length;
						var fileCnt = self.deletableFiles.length;

						if (folderCnt > 0 || fileCnt > 0) {
							var fText = fileCnt > 1 ? "Files" : fileCnt == 1 ? "File" : "";
							var fldrText = folderCnt > 1 ? "Folders" : folderCnt == 1 ? "Folder" : "";
							var combinedText = fText + ((fText && fldrText) ? " and " : "") + fldrText;
							var confirmText = 'Are you sure you want to permanently delete the following ' + combinedText + '?';
							var warning = 'This action CANNOT be undone.';
							var multiFile = 'Are you sure you want to permanently delete the following files? This action CANNOT be undone.';
							var undeletableFiles = combinedText + ' with warnings will not deleted.';

							self.title = "Confirm Delete " + combinedText;
							self.confirmText = confirmText + " " + warning + " " + undeletableFiles;
							self.showSubmit = true;
							self.cancelText = 'No';
							self.successText = combinedText + ' successfully deleted.'
						} else {
							if (self.testServerAPI) {
								self.title = "Confirm Delete API Testing";
								self.showSubmit = true;
								self.cancelText = 'cancel';
							} else {
								self.title = "Can't Delete Anything";
								self.showSubmit = false;
								self.cancelText = 'OK';
							}
						}
						self.busy = false;
					}

					function cancel() {
						$modalInstance.dismiss('cancel');
					}

					function submit () {
						self.busy = true;
						var testUI = false;
						if (testUI) {
							$timeout(function() {
								self.busy = false;
								$modalInstance.close();
							},1000);
							return;
						}
						var folders = self.testServerAPI ? self.folders : self.deletableFolders;
						var files = self.testServerAPI ? self.files : self.deletableFiles;
						DeleteService.deleteFilesAndDirs(folders,files, self.project)
						.then(function (result) {
							self.busy = false;
							console.log('success result', result);
							AlertService.success(self.successText);
							$modalInstance.close(result);
							if (self.successCallback) { self.successCallback(); }
						}, function (err) {
							console.log("error from delete", err)
							var msg;
							if (err.data && err.data.messsage && Array.isArray(err.data.message)) {
								var docs = err.data.message
							}
							self.busy = false
							AlertService.error(err.message);
							$scope.$apply();
							if (self.errorCallback) { self.errorCallback(); }
						});
					}
				}
			});
		});
	};
}])
.service('DeleteService', ['Document', 'DocumentMgrService', function (Document, DocumentMgrService) {
	var service = this;
	service.deleteFilesAndDirs = deleteFilesAndDirs;

	function deleteDocument(documentID) {
		return Document.lookup(documentID)
		.then( function (doc) {
			return Document.getProjectDocumentVersions(doc._id);
		})
		.then( function (docs) {
			// Are there any prior versions?  If so, make them the latest and then delete
			// otherwise delete
			if (docs.length > 0) {
				return Document.makeLatestVersion(docs[docs.length-1]._id);
			} else {
				return null;
			}
		})
		.then( function () {
			// Delete it from the system.
			return Document.deleteDocument(documentID);
		});
	}

	function deleteFilesAndDirs(deletableFolders, deletableFiles, project) {
		self.busy = true;

		var dirPromises = _.map(deletableFolders, function(d) {
			return DocumentMgrService.removeDirectory(project, d);
		});

		var filePromises = _.map(deletableFiles, function(f) {
			return deleteDocument(f._id);
		});

		var directoryStructure;
		return Promise.all(dirPromises)
		.then(function(result) {
			console.log("Delete folders result", result)
			if (!_.isEmpty(result)) {
				var last = _.last(result);
				directoryStructure = last.data;
			}
			return Promise.all(filePromises);
		})
		// .then(function(result) {
		// 	if (directoryStructure) {
		// 		// $scope.project.directoryStructure = directoryStructure;
		// 		//$scope.$broadcast('documentMgrRefreshNode', { directoryStructure: directoryStructure });
		// 	}
		// });
	}
}]);
