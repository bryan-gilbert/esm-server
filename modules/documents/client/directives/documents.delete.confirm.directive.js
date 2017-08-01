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
.service('ConfirmDeleteService', ['$rootScope', '$modal', '_', function ($rootScope, $modal, _) {
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
					// caller may have batch or single file
					self.deleteCallback = scope.deleteCallback;
					self.submit = submit;
					self.cancel = cancel;
					self.showSubmit = true;
					self.cancelText = 'No';
					// collect deletable folders and files
					function collect(items) {
						var items = Array.isArray(items) ? items : [ items ];
						var cnt = 0;
						var fakeChildren = false;
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
							cnt += fClone.canBeDeleted ? 1 : 0;
							if (!fClone.canBeDeleted) {
								fClone.reason = (
										!fClone.userCanPublish ? "Not authorized to delete" :
										fClone.isPublished ? "Can not delete published content" :
										fClone.hasChildren ? "Folder is not empty" : ""
								);
							}
							fakeChildren = !fakeChildren;/// alternating folders will pretend to have children
							return fClone;
						});
						return {list: results, canDeleteCount: cnt};
					}

					self.model = { };
					self.model.folders = collect(scope.folders);
					self.model.files = collect(scope.files);
					self.combindedList = self.model.folders.list.concat(self.model.files.list);
					if (self.model.files.canDeleteCount > 0 || self.model.folders.canDeleteCount > 0) {
						self.confirmText = "TBD"
					} else {
						self.showSubmit = false;
						self.cancelText = 'OK';
					}

					function cancel() {
						$modalInstance.dismiss('cancel');
					}

					function submit () {
						console.log("invoke delete");
						// self.deleteCallback(self.publishableFiles)
						// .then(function (result) {
						// 	$modalInstance.close(result);
						// }, function (err) {
						// 	self.errMsg = err.message;
						// 	$scope.$apply();
						// });
					}
				}
			});
		});
	};
}]);
