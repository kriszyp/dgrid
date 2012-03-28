define(["dojo/_base/declare", "dgrid/OnDemandGrid", "dgrid/ColumnSet", "dgrid/Selection", "dgrid/Keyboard", "dgrid/tree", "dgrid/demos/gantt/ganttColumn"], 
		function(declare, OnDemandGrid, ColumnSet, Selection, Keyboard, tree, ganttColumn){
	// we create a new grid that has a column set definition for tasks, resources, and the visual chart
	return declare([OnDemandGrid, ColumnSet, Selection, Keyboard], {
		columnSets: [
			[
				{
					name: tree({label: "Task"}),
					resource: "Resource"
				}
			],
			[
				{ // this is the visual bars and dependency lines for the gantt chart
					chart: ganttColumn({
						scale: 4000000,
						start: 1327800000000,
						end: 1330000000000
					})
				}
			]
		]
	});
});