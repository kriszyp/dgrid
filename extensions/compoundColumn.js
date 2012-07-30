define(["dojo/_base/lang", "put-selector/put"], 
	function(lang, put){
		return function(column){
			function render(column, container, grid, object, options, header){
				var table = put(container, "!dgrid-cell!dgrid-cell-padding table.dgrid-nesting-table");
				var row, children = column.children;
				if(header){
					var th = put(table, "tr th", column.label);
					th.colSpan = children.colSpan;
				}
				if(children){
					var row = put(table, "tr td", grid.createRowCells(header ? "th" : "td", function(cell, column){
						this[header ? "renderHeaderCell" : "renderCell"](cell, column, object, options);
					}, [column.children]), ".dgrid-nesting-table"/*, "!dgrid-row-table"*/);
					row.style.width = "100%"
/*					for(var i = 0; i < children.length; i++){
						var child = column.children[i];
						if("label" in child){
							if(!row){
								row = put(table, "tr");
							}
							grid[header ? "renderHeaderCell" : "renderCell"](put(row, header ? "th" : "td"), child, object, options);
						}
					}*/
				}
			}

			column.renderHeaderCell = function(th){
				render(column, th, column.grid, null, null, true);
			};
			column.renderCell = function(object, value, td, options){
				render(column, td, column.grid, object, options);
			}
			return column;
		};
});
