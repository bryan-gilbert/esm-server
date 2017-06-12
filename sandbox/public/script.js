/**
 * Created by bryangilbert on 2017/06/09.
 * All rights reserved © Copyright 2016 - MemSharp Technologies Inc.
 */
"use strict";
angular
.module('app')
.constant('TreeModel', window.TreeModel)
.factory('TagFactory', ['TreeModel', TagFactory ])
.controller('tagSelectModalController', tagSelectModalControllerImpl )
.directive('prototypeModal', ['$modal', prototypeDirective ])
.controller('tagSelectController', ['TagFactory', tagSelectControllerImpl ])
.directive('tagSelector', ['$modal', tagSelectorDirective ]);

function prototypeDirective($modal) {
	return {
		restrict: 'A',
		scope: {
		},
		link: function (scope, element, attrs) {
			element.on('click', function () {
				$modal.open({
					animation: true,
					templateUrl: './tagSelect-modal.html',
					controllerAs: 'vmm',
					size: 'lg',
					resolve: {
					},
					controller: 'tagSelectModalController'
				});
			});
		}
	};
}

function tagSelectModalControllerImpl($modalInstance) {
	var self = this;

	self.cancel = cancel;
	self.ok = submit;

	function cancel() {
		$modalInstance.dismiss('cancel');
	}
	function submit() {
		$modalInstance.close('results TBD');
	}

}

function tagSelectorDirective() {
	return {
		restrict: 'E',
		templateUrl: 'tagSelect.html',
		controller: 'tagSelectController',
		controllerAs: 'vm'
	};
}


function tagSelectControllerImpl(TagFactory) {
	var testInitialDocTypes = [
		"Inspection Report; Health & Safety; Occupational Health; Ergonomics"
		, "Inspection Report; Reclamation; Environmental Geoscience"
		, "Geotechnical; Dam Safety Inspection Report"
	];

	testInitialDocTypes = [];
	var self = this;
	self.title = "Prototype nested tags";
	self.click = clickHandler;
	self.rootNode = TagFactory;
	// initialize checked state based on incoming tag set;
	initDocType(testInitialDocTypes);

	// update doc type results
	updateDocTypeResult();

	// init done. The following code is now function definitions.

	// clickHandler: adjust checked state of children and update overall doc type results
	function clickHandler($event) {
		// get the Node identified by the id attributed
		var t = $event.currentTarget.id;
		var nodeId = t.split('-')[1];
		nodeId = parseInt(nodeId);
		var theNode = self.rootNode.first(function (n) {
			return n.id === nodeId;
		});
		// If node is being unchecked then make sure children are unchecked.
		theNode.walk(function(child){
			var isChecked = child.checked;
			// skip the current node if it's the node we started the walk with.
			if (theNode !== child) {
				if (isChecked) {
					child.checked = false;
				}
			}
		});
		updateDocTypeResult();
	}

	// updateDocTypeResult: walk the tree and compose tag sets.
	function updateDocTypeResult () {
		var allTags = [];
		self.rootNode.walk(function (child) {
			if (child.checked) {
				var grandChildren = child.children;
				if (grandChildren) {
					var hasCheckedChild = false;
					_.forEach(grandChildren, function (grandChild) {
						if (grandChild.checked) {
							hasCheckedChild = true;
							return false;
						}
					});
					if (!hasCheckedChild) {
						var tag = composeTagsForNode(child);
						allTags.push(tag);
					}
				}
			}
		});
		self.docTypeResult = allTags;
	}


	// initDocType: initialize check state for incoming tag set
	function initDocType(initialDocTypes) {
		self.rootNode.walk( function (child) {
			var dt = composeTagsForNode(child);
			_.forEach( initialDocTypes, function (idt) {
				if (idt == dt) {
					var path = child.getPath();
					_.forEach( path, function(p) { p.checked = true; });
				}
			})
		});
	}

	// composeTagsForNode: create tag set based on check state of tree nodes
	function composeTagsForNode(node) {
		var path = node.getPath();
		var dtResult = [];
		path.shift();
		_.forEach(path, function(p) {
			dtResult.push(p.model.name);
		});
		dtResult = dtResult.join(' > ');
		return dtResult;
	}
}


function TagFactory(TreeModel) {
	var self = this;
	self.rootNode = undefined;
	var tags = getTags().tags;
	sortTags();
	initTree();
	return self.rootNode;

	// sortTags: before creating the tree sort the children
	function sortTags() {
		var queue = [tags];
		(function sort() {
			var i, cnt, tag;
			if (queue.length === 0) {
				return;
			}
			tag = queue.shift();
			for (i = 0, cnt = tag.children.length; i < cnt; i++) {
				queue.push(tag.children[i]);
			}
			tag.children = _.sortBy(tag.children, function(c) {return c.name});
		})();
	}

	// initTree: create the tag tree from tag factory
	function initTree () {
		self.rootNode = (new TreeModel()).parse(tags);
		// copy id and name from model onto tree node to keep code clean and simple to read.
		self.rootNode.walk( function(child) {
			child.id = child.model.id;
			child.name = child.model.name;
		});
	}
}


function getTags() {
	var sid = 0;
	function createId() {
		return sid++;
	}
	// Be careful that each element has an ID or tree traversals will fail.
	var level3 = function(sid) {
		return [
			{
				id: createId(),
				name: 'Health & Safety',
				children: [
					{
						id: createId(),
						name: 'Occupational Health',
						children: [{
							id: createId(),
							name: 'Ergonomics'
						}]
					}
				]
			}, {
				id: createId(),
				name: 'Permitting'
			}, {
				id: createId(),
				name: 'Reclamation',
				children: [{
					id: createId(),
					name: 'Environmental Geoscience'
				}]
			}, {
				id: createId(),
				name: 'Geotechnical'
			}, {
				id: createId(),
				name: 'Electrical'
			}, {
				id: createId(),
				name: 'Mechanical'
			}];
	};
	var mainTags = {
			id: createId(),
			name: 'ROOT',
			children: [
				{
					id: createId(),
					name: 'Annual Report',
					children: [{
						id: createId(),
						name: 'Annual Reclamation Report'
					}]
				}, {
					id: createId(),
					name: 'Inspection Report',
					children: level3()
				}, {
					id: createId(),
					name: 'Inspection Report Response',
					children: level3()
				}, {
					id: createId(),
					name: 'Inspection Follow Up',
					children: level3()
				}, {
					id: createId(),
					name: 'Geotechnical',
					children: [{
						id: createId(),
						name: 'Dam Safety Inspection Report'
					}, {
						id: createId(),
						name: 'Dam Safety Review'
					}]
				}, {
					id: createId(),
					name: 'Authorizations'
				}, {
					id: createId(),
					name: 'Management Plan'
				}, {
					id: createId(),
					name: 'Application Document'
				}, {
					id: createId(),
					name: 'Correspondence'
				},
				{
					id: createId(),
					name: 'Order',
					children: [{
						id: createId(),
						name: 'Order issued under the Mines Act'
					}, {
						id: createId(),
						name: 'Order issued under the Environmental Management Act'
					},	{
						id: createId(),
						name: 'Order issued under the Environmental Assessment Act'
						}]
				}, {
					id: createId(),
					name: 'Other'
				}]
		}
	;

	return {tags: mainTags};
}