define(["dojo/store/Memory"],
function(Memory){
	return new Memory({data:[
			{name: "Create a column plugin", resource: "Bryan Forbes",  start: 1327900000000, end: 1328300000000, completed: 0.9, id: 1},
			{name: "Define a column set", resource: "Colin Snover",start: 1328100000000, end: 1328400000000, completed: 0.9, id: 2},
			{name: "Draw colored bars", resource: "Kris Zyp", start: 1329100000000, end: 1329800000000, completed: 0.4, dependencies:[1], id: 3},
			{name: "Draw dependency arrows", resource: "Bryan Forbes", start: 1328400000000, end: 1328900000000, completed: 0.4, dependencies:[1], id: 4},
			{name: "Setup a tree column plugin", start: 1329000000000, end: 1329800000000, completed: 0.4, id: 5, hasChildren: true},
			{name: "Define getChildren method", resource: "Ken Franqueiro", start: 1329000000000, end: 1329400000000, completed: 0.4, id: 6, parent: 5},
			{name: "Define tree column", resource: "Chris Barrett", start: 1329400000000, end: 1329800000000, completed: 0.4, dependencies:[2], id: 7, parent: 5}
		],
		getChildren: function(parent, options){
			return this.query({parent: parent.id}, options);
		},
		mayHaveChildren: function(parent){
			return parent.hasChildren;
		}
	});
});