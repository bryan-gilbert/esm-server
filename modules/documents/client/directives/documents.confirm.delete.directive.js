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
			$modal.open({
				animation: true,
				templateUrl: 'modules/documents/client/views/partials/modal-document-confirm-delete.html',
				resolve: {},
				size: 'lg',
				controllerAs: 'confirmDlg',
				controller: function ($scope, $modalInstance) {
					var self = this;
					/*
						Set the following to true, during development, if you want to test the server side delete API.
						This will bypass the client side tests and send all selected files or folders.
						This is also a good way to test the client side error handling.
					 */
					self.testServerAPI = false;

					self.busy           = true;
					self.deleteCallback = scope.deleteCallback;
					self.submit         = submit;
					self.cancel         = cancel;

					// Initialize ....
					init();

					// collect deletable folders and files
					function collect(items) {
						if (!items ) {
							return [];
						}
						items = Array.isArray(items) ? items : [ items ];
						var results = _.map(items).map(function(item) {
							var fClone = _.clone(item);
							if (fClone.type === 'File') {
								// clone has f.isPublished and f.displayName
								fClone.userCanPublish = item.userCan.publish;
								fClone.hasChildren    = false;
								fClone.type           = ['png','jpg','jpeg'].indexOf(fClone.internalExt) > -1 ? 'Picture' : 'File';
							} else {
								fClone.userCanPublish = item.model.folderObj.userCan.publish;
								fClone.hasChildren    = false;// TODO in future ... do magic to count children;
								fClone.isPublished    = item.model.published;
								fClone.displayName    = item.model.name;
								fClone.type           = 'Folder';							}
								fClone.canBeDeleted   = fClone.userCanPublish && !fClone.isPublished && !fClone.hasChildren;
							if (!fClone.canBeDeleted) {
								fClone.reason = (
									!fClone.userCanPublish  ? "Not authorized to delete" :
									fClone.isPublished      ? "Published content won't be deleted" :
									fClone.hasChildren      ? "Folders with content won't be deleted" : ""
								);
							}
							return fClone;
						});
						return results;
					}

					function init() {
						self.folders           = collect(scope.folders);
						self.files             = collect(scope.files);
						self.deletableFolders  = _.filter(self.folders, function (item) {
							return item.canBeDeleted;
						});
						self.deletableFiles    = _.filter(self.files, function (item) {
							return item.canBeDeleted;
						});
						// the combined list is used by the ng-repeat
						self.combindedList     = self.folders.concat(self.files);
						var folderCnt          = self.deletableFolders.length;
						var fileCnt            = self.deletableFiles.length;

						if (folderCnt > 0 || fileCnt > 0) {
							if (self.folders.length > folderCnt || self.files.length > fileCnt ) {
								self.hasBlockedContent = true;
								self.bannerText = "Some content has been published. Content MUST be unpublished before it can be deleted";
							}
							var fText            = fileCnt > 1 ? "Files" : fileCnt === 1 ? "File" : "";
							var fldrText         = folderCnt > 1 ? "Folders" : folderCnt === 1 ? "Folder" : "";
							var combinedText     = fText + ((fText && fldrText) ? " and " : "") + fldrText;
							var confirmText      = 'Are you sure you want to permanently delete the following ' + combinedText.toLowerCase() + '?';
							var warning          = 'This action CANNOT be undone.';
							var undeletableText  = 'Any content showing a warning will not be deleted.';
							self.title           = "Confirm Delete " + combinedText;
							self.confirmText     = confirmText + " " + warning + " " + undeletableText;
							self.showSubmit      = true;
							self.cancelText      = 'No';
						} else {
							// No files and no folders can be deleted
							if (self.testServerAPI) {
								self.title      = "Confirm Delete API Testing";
								self.showSubmit = true;
								self.cancelText = 'cancel';

							} else {
								self.title      = "Published content can't be deleted";
								self.showSubmit = false;
								self.cancelText = 'OK';
								self.hasBlockedContent = true;
								self.bannerText = "Content MUST be unpublished before it can be deleted";
							}
						}
						self.busy = false;
					}

					function cancel() {
						$modalInstance.dismiss('cancel');
					}

					function submit () {
						self.busy = true;
						var folders = self.testServerAPI ? self.folders : self.deletableFolders;
						var files = self.testServerAPI ? self.files : self.deletableFiles;
						self.deleteCallback(folders,files)
						.then(function (result) {
							self.busy = false;
							$modalInstance.close(result);
						}, function (err) {
							self.busy = false;
							self.errMsg = err.message;
							$scope.$apply();
						});
					}
				}
			});
		});
	};
}]);
