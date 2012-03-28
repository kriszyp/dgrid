define(["dojo/_base/declare", "dojo/on", "dojo/_base/array", "dojo/dom-construct", "dojo/date/locale"],
function(declare, on, array, construct, dateLocale){

return function(column){
	// summary:
	//      Create a column plugin for special rendering of gantt style charts in a column
	var dependencyRow, firstCell, create = construct.create;
	column.renderCell = function(object, value, td){
		// we need to make some content to ensure that it is normal height column:
		td.innerHTML = "&nbsp;";
		// we create the colored task bar representing the duration of a task
		var taskBar = create("span", {className:"task-bar"}, td);
		// define the start and length of the task bar
		var start, width;
		taskBar.style.left = (start = (object.start - column.start) / column.scale) + "px";
		taskBar.style.width = (width = (object.end - object.start) / column.scale) + "px";
		// now created an overlay for how much has been completed
		var completedBar = create("span", {className: "completed-bar"}, td);
		// define the start and length of the completed bar
		completedBar.style.left = start + "px";
		completedBar.style.width = width * object.completed + "px";
		// record this for depedency lines
		td.finished = start + width;
		
		firstCell = firstCell || td;
		
		var grid = column.grid;
		// next we will create arrows for any dependencies
		array.forEach(object.dependencies, function(dependency){
			// we wait for the next event turn, after the rendering is done, so that the 
			// elements are attached to the DOM and can be measured
			setTimeout(function(){
				if(!dependencyRow){
					 // we put a special column set at the beginning so that all the dependency
					 // lines can be gathered here, and will be properly scrolled horizontally 
					 // along with the rest of the 
					dependencyRow = create("div", {className:"dependency-container"}, getColumnSetElement(firstCell), "before"); // this exists to prevent a rendering glitch
					// this is the scrolling container
					dependencyRow = create("div", {className:"dgrid-column-set dependency-row",
						colsetid: 1}, dependencyRow);
					// this is the div that contains the dependency arrows  
					dependencyRow = create("div", {className:"dependencies dgrid-column-chart"}, dependencyRow); 
				}
				// now we start creating the dependency lines and arrows
				
				// this is the cell that corresponds to the dependency, the starting point of the dependency line
				var cell = grid.cell(dependency, column.id).element;
				// create the horizontal line part of the arrow 
				var hline = create("span", {className:"dep-horizontal-line"}, dependencyRow);
				// we find the location of the starting cell and use that to place the horizontal line
				var top = getColumnSetElement(cell).offsetTop + 10;
				hline.style.top = top + "px";
				hline.style.left = cell.finished + 5 + "px";
				// the start variable is the starting point of the target dependent cell
				hline.style.width = start - cell.finished - 4 + "px";
				// now we create the vertical line and position it
				var vline = create("span", {className:"dep-vertical-line"}, dependencyRow);
				vline.style.top = top + 2 + "px";
				vline.style.left = start + "px";
				var tdTop = getColumnSetElement(td).offsetTop - 5;
				vline.style.height = tdTop - getColumnSetElement(cell).offsetTop + "px";
				// now we create the arrow at the end of the line, position it correctly
				var arrow = create("span", {className:"ui-icon down-arrow"}, dependencyRow);
				arrow.style.top = tdTop + "px";
				arrow.style.left = start - 7 + "px";
			});
		});
	};
	column.renderHeaderCell = function(th){
		// here we render the header for the gantt chart, this will be a row of dates
		// with days of the week in a row underneath  
		var table = create("table",{},th);
		// Create the date row
		var dateRow = create("tr", {}, table);
		var date = new Date(column.start);
		var lastDay = 7;
		// now we iterate through the time span, incrementing by date
		while(date.getTime() < column.end){
			// each time a new week is started, we right a new date for the week
			if(date.getDay() < lastDay){
				// create the cell
				create("td", {
					// format the date for the contents of this cell
					innerHTML: lastDay - date.getDay() > 2 ? dateLocale.format(date, {selector: "date"}) : "",
					colSpan: lastDay - date.getDay(), // span all the days of the week
					style: {
						// give it a width that is correct for the time scale
						width: (lastDay - date.getDay()) * 86400000 / column.scale + "px",
					}
				}, dateRow);
				
			}
			lastDay = date.getDay();
			date = new Date(date.getTime() + 86400000); // increment a day
		}
		// now we create a row for the days of the week
		var dayRow = create("tr", {}, table);
		// restart the time iteration, and iterate again
		var date = new Date(column.start);
		while(date.getTime() < column.end){
			create("td", {
				// format the date as a name of the day of the week, keeping just the first character
				innerHTML: dateLocale.format(date, {selector: "date", datePattern:"EEE"}).substring(0, 1),
				style: {// scale it again
					width: (86400000) / column.scale + "px"
				}
			}, dayRow);
			date = new Date(date.getTime() + 86400000); // increment a day
		}
	};
	return column;
};
function getColumnSetElement(element){
	// this finds the column set div for a given cell element
	do{
		element = element.parentNode;
	}while(element.className != "dgrid-column-set");
	return element;
}
});