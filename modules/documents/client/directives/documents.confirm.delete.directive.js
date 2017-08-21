'use strict';
angular.module('documents')
.directive('confirmDelete', ['ConfirmDeleteService', function (ConfirmDeleteService) {
	// x-confirm-delete
	return {
		restrict: 'A',
		scope: {
			files: '=',
			folders: '=',
			deleteCallback: '='
		},
		link: function (scope, element, attrs) {
			element.on('click', function () {
				ConfirmDeleteService.confirmDialog(scope);
			});
		}
	};
}])
.service('ConfirmDeleteService', ['$rootScope', '$modal', '_', '$timeout', function ($rootScope, $modal, _, $timeout) {
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

					// TODO  remove this before PR.
					var fakeChildren = false;

					/*
						To test the server side delete API and make sure that it does not allow deletion of folders or
						files that fail the "can delete" test ... set the following to true.  This will bypass the
						client side tests and send all selected files or folders.
						This is also a good way to test the client side error handling.
					 */
					self.testServerAPI = false;

					// caller may have batch or single file
					self.deleteCallback = scope.deleteCallback;
					self.submit = submit;
					self.cancel = cancel;
					init();

					// collect deletable folders and files
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
							fakeChildren = !fakeChildren;/// alternating folders will pretend to have children
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

						self.deleteCallback(folders,files)
						.then(function (result) {
							self.busy = false
							$modalInstance.close(result);
						}, function (err) {
							self.busy = false
							self.errMsg = err.message;
							$scope.$apply();
						});
					}
				}
			});
		});
	};
}]);

/*

function deleteDir(doc) {
	self.busy = true;
	return DocumentMgrService.removeDirectory($scope.project, doc)
	.then(function (result) {
		$scope.project.directoryStructure = result.data;
		$scope.$broadcast('documentMgrRefreshNode', {directoryStructure: result.data});
		self.busy = false;
		AlertService.success('The selected folder was deleted.');
	}, function(docs) {
		var msg = "";
		var theDocs = [];
		if (docs.data.message && docs.data.message[0] && docs.data.message[0].documentFileName) {
			_.each(docs.data.message, function (d) {
				theDocs.push(d.documentFileName);
			});
			msg = 'This action cannot be completed as the following documents are in the folder: ' + theDocs + '.';
		} else {
			msg = "Could not delete folder, there are still files in the folder.";
		}

		$log.error('DocumentMgrService.removeDirectory error: ', msg);
		self.busy = false;
		AlertService.error(msg);
	});
};

function deleteFile(doc) {
	self.busy = true;
	return self.deleteDocument(doc._id)
	.then(function(result) {
		self.selectNode(self.currentNode.model.id); // will mark as not busy...
		var name = doc.displayName || doc.documentFileName || doc.internalOriginalName;
		AlertService.success('Delete File', 'The selected file was deleted.');
	}, function(error) {
		$log.error('deleteFile error: ', JSON.stringify(error));
		self.busy = false;
		AlertService.error('The selected file could not be deleted.');
	});
};

function deleteFilesAndDirs(deletableFolders, deletableFiles) {
	self.busy = true;

	var dirPromises = _.map(deletableFolders, function(d) {
		return DocumentMgrService.removeDirectory($scope.project, d);
	});

	var filePromises = _.map(deletableFiles, function(f) {
		return self.deleteDocument(f._id);
	});

	var directoryStructure;
	return Promise.all(dirPromises)
	.then(function(result) {
		console.log("Delete folders result", result)
		//$log.debug('Dir results ', JSON.stringify(result));
		if (!_.isEmpty(result)) {
			var last = _.last(result);
			directoryStructure = last.data;
		}
		return Promise.all(filePromises);
	})
	.then(function(result) {
		//$log.debug('File results ', JSON.stringify(result));
		if (directoryStructure) {
			//$log.debug('Setting the new directory structure...');
			$scope.project.directoryStructure = directoryStructure;
			$scope.$broadcast('documentMgrRefreshNode', { directoryStructure: directoryStructure });
		}
		//$log.debug('Refreshing current directory...');
		self.selectNode(self.currentNode.model.id);
		self.busy = false;
		AlertService.success('The selected items were deleted.');
	}, function(err) {
		console.log("err result", err)
		self.busy = false;
		AlertService.error('The selected items could not be deleted.');
	});
};

*/

/*
self.deleteSelected = {
	titleText: 'Delete File(s)',
	okText: 'Yes',
	cancelText: 'No',
	ok: function() {
		var dirs = _.size(self.checkedDirs);
		var files = _.size(self.checkedFiles);
		if (dirs === 0 && files === 0) {
			return Promise.resolve();
		} else {
			$timeout(doDelete, 10);
			return Promise.resolve();
		}
		// do the work ....
		// function doDelete() {
		// 	self.busy = true;
		//
		// 	var dirPromises = _.map(self.deleteSelected.deleteableFolders, function(d) {
		// 		return DocumentMgrService.removeDirectory($scope.project, d);
		// 	});
		//
		// 	var filePromises = _.map(self.deleteSelected.deleteableFiles, function(f) {
		// 		return self.deleteDocument(f._id);
		// 	});
		//
		// 	var directoryStructure;
		// 	return Promise.all(dirPromises)
		// 		.then(function(result) {
		// 			//$log.debug('Dir results ', JSON.stringify(result));
		// 			if (!_.isEmpty(result)) {
		// 				var last = _.last(result);
		// 				directoryStructure = last.data;
		// 			}
		// 			return Promise.all(filePromises);
		// 		})
		// 		.then(function(result) {
		// 			//$log.debug('File results ', JSON.stringify(result));
		// 			if (directoryStructure) {
		// 				//$log.debug('Setting the new directory structure...');
		// 				$scope.project.directoryStructure = directoryStructure;
		// 				$scope.$broadcast('documentMgrRefreshNode', { directoryStructure: directoryStructure });
		// 			}
		// 			//$log.debug('Refreshing current directory...');
		// 			self.selectNode(self.currentNode.model.id);
		// 			self.busy = false;
		// 			AlertService.success('The selected items were deleted.');
		// 		}, function(err) {
		// 			self.busy = false;
		// 			AlertService.error('The selected items could not be deleted.');
		// 		});
		// }
	},
	cancel: undefined,
	confirmText:  'Are you sure you want to delete the selected item(s)?',
	confirmItems: [],
	deleteableFolders: [],
	deleteableFiles: [],
	setContext: function() {
		self.deleteSelected.confirmItems = [];
		self.deleteSelected.titleText = 'Delete selected';
		self.deleteSelected.confirmText = 'Are you sure you want to delete the following the selected item(s)?';
		var dirs = _.size(self.checkedDirs);
		var files = _.size(self.checkedFiles);
		if (dirs > 0 && files > 0) {
			self.deleteSelected.titleText = 'Delete Folder(s) and File(s)';
			self.deleteSelected.confirmText = 'Are you sure you want to delete the following ('+ dirs +') folders and ('+ files +') files?';
		} else if (dirs > 0) {
			self.deleteSelected.titleText = 'Delete Folder(s)';
			self.deleteSelected.confirmText = 'Are you sure you want to delete the following ('+ dirs +') selected folders?';
		} else if (files > 0) {
			self.deleteSelected.titleText = 'Delete File(s)';
			self.deleteSelected.confirmText = 'Are you sure you want to delete the following ('+ files +') selected files?';
		}

		self.deleteSelected.confirmItems = [];
		self.deleteSelected.deleteableFolders = [];
		self.deleteSelected.deleteableFiles = [];

		_.each(self.checkedDirs, function(o) {
			if ($scope.project.userCan.manageFolders) {
				self.deleteSelected.confirmItems.push(o.model.name);
				self.deleteSelected.deleteableFolders.push(o);
			}
		});
		_.each(self.checkedFiles, function(o) {
			if (o.userCan.delete) {
				var name = o.displayName || o.documentFileName || o.internalOriginalName;
				self.deleteSelected.confirmItems.push(name);
				self.deleteSelected.deleteableFiles.push(o);
			}
		});

	}
};
*/
