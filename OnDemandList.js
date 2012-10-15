define(["./List", "./_StoreMixin", "dojo/_base/declare", "dojo/_base/lang", "dojo/_base/Deferred", "dojo/on", "./util/misc", "put-selector/put"],
function(List, _StoreMixin, declare, lang, Deferred, listen, miscUtil, put){

return declare([List, _StoreMixin], {
	// minRowsPerPage: Integer
	//		The minimum number of rows to request at one time.
	minRowsPerPage: 25,
	// maxRowsPerPage: Integer
	//		The maximum number of rows to request at one time.
	maxRowsPerPage: 100,
	// maxEmptySpace: Integer
	//		Defines the maximum size (in pixels) of unrendered space below the
	//		currently-rendered rows. Setting this to less than Infinity can be useful if you
	//		wish to limit the initial vertical scrolling of the grid so that the scrolling is
	// 		not excessively sensitive. With very large grids of data this may make scrolling
	//		easier to use, albiet it can limit the ability to instantly scroll to the end.
	maxEmptySpace: Infinity,	
	// bufferRows: Integer
	//	  The number of rows to keep ready on each side of the viewport area so that the user can
	//	  perform local scrolling without seeing the grid being built. Increasing this number can
	//	  improve perceived performance when the data is being retrieved over a slow network.
	bufferRows: 10,
	// farOffRemoval: Integer
	//		Defines the minimum distance (in pixels) from the visible viewport area
	//		rows must be in order to be removed.  Setting to Infinity causes rows
	//		to never be removed.
	farOffRemoval: 2000,
	
	rowHeight: 22,
	
	// queryRowsOverlap: Integer
	//		Indicates the number of rows to overlap queries. This helps keep
	//		continuous data when underlying data changes (and thus pages don't
	//		exactly align)
	queryRowsOverlap: 1,
	
	// pagingDelay: Integer
	//		Indicates the delay (in milliseconds) to wait before paging in more data
	//		on scroll. This can be increased for low-bandwidth clients, or to
	//		reduce the number of requests against a server 
	pagingDelay: miscUtil.defaultDelay,

	postCreate: function(){
		this.inherited(arguments);
		var self = this;
		// check visibility on scroll events
		listen(this.bodyNode, "scroll",
			this._throttledProcessScroll = miscUtil.throttleDelayed(function(event){ self._processScroll(event); },
				null, this.pagingDelay));
	},
	
	renderQuery: function(query, preloadNode, options){
		// summary:
		//		Creates a preload node for rendering a query into, and executes the query
		//		for the first page of data. Subsequent data will be downloaded as it comes
		//		into view.
		var preload = {
			query: query,
			count: 0,
			node: preloadNode,
			options: options
		};
		if(!preloadNode){
			var rootQuery = true;
			var topPreload = {
				node: put(this.contentNode, "div.dgrid-preload", {
					rowIndex: 0
				}),
				count: 0,
				//topPreloadNode.preload = true;
				query: query,
				next: preload,
				options: options
			};
			preload.node = preloadNode = put(this.contentNode, "div.dgrid-preload");
			preload.previous = topPreload;
		}
		preloadNode.bottom = true;
		// this preload node is used to represent the area of the grid that hasn't been
		// downloaded yet
		preloadNode.rowIndex = this.minRowsPerPage;

		var priorPreload = this.preload;
		if(priorPreload){
			// the preload nodes (if there are multiple) are represented as a linked list, need to insert it
			if((preload.next = priorPreload.next) && 
					// check to make sure that the current scroll position is below this preload
					this.bodyNode.scrollTop >= priorPreload.node.offsetTop){ 
				// the prior preload is above/before in the linked list
				preload.previous = priorPreload;
			}else{
				// the prior preload is below/after in the linked list
				preload.next = priorPreload;
				preload.previous = priorPreload.previous;
			}
			// adjust the previous and next links so the linked list is proper
			preload.previous.next = preload;
			preload.next.previous = preload; 
		}else{
			this.preload = preload;
		}
		var loadingNode = put(preloadNode, "-div.dgrid-loading");
		put(loadingNode, "div.dgrid-below", this.loadingMessage);
		// Establish query options, mixing in our own.
		// (The getter returns a delegated object, so simply using mixin is safe.)
		options = lang.mixin(this.get("queryOptions"), options, 
			{start: 0, count: this.minRowsPerPage, query: query});
		// execute the query
		var results = query(options);
		var self = this;
		// render the result set
		Deferred.when(this.renderArray(results, preloadNode, options), function(trs){
			return Deferred.when(results.total || results.length, function(total){
				// remove loading node
				put(loadingNode, "!");
				// now we need to adjust the height and total count based on the first result set
				var trCount = trs.length;
				total = total || trCount;
				if(!total){
					put(self.contentNode, "div.dgrid-no-data").innerHTML = self.noDataMessage;
				}
				var height = 0;
				for(var i = 0; i < trCount; i++){
					height += self._calcRowHeight(trs[i]);
				}
				// only update rowHeight if we actually got results and are visible
				if(trCount && height){ self.rowHeight = height / trCount; }
				
				total -= trCount;
				preload.count = total;
				preloadNode.rowIndex = trCount;
				if(total){
					preloadNode.style.height = Math.min(total * self.rowHeight, self.maxEmptySpace) + "px";
				}else{
					// if total is 0, IE quirks mode can't handle 0px height for some reason, I don't know why, but we are setting display: none for now
					preloadNode.style.display = "none";
				}
				self._processScroll(); // recheck the scroll position in case the query didn't fill the screen
				// can remove the loading node now
				return trs;
			});
		});

		// return results so that callers can handle potential of async error
		return results;
	},
	
	refresh: function(){
		this.inherited(arguments);
		if(this.store){
			// render the query
			var self = this;
			this._trackError(function(){
				return self.renderQuery(function(queryOptions){
					return self.store.query(self.query, queryOptions);
				});
			});
		}
	},
	
	_calcRowHeight: function(rowElement){
		// summary:
		//		Calculate the height of a row. This is a method so it can be overriden for
		//		plugins that add connected elements to a row, like the tree
		
		var sibling = rowElement.previousSibling;
		return sibling && sibling.offsetTop != rowElement.offsetTop ?
			rowElement.offsetHeight : 0;
	},
	
	lastScrollTop: 0,
	_processScroll: function(evt){
		// summary:
		//		Checks to make sure that everything in the viewable area has been
		//		downloaded, and triggering a request for the necessary data when needed.
		var grid = this,
			scrollNode = grid.bodyNode,
			// grab current visible top from event if provided, otherwise from node
			visibleTop = (evt && evt.scrollTop) || scrollNode.scrollTop,
			visibleBottom = scrollNode.offsetHeight + visibleTop,
			priorPreload, preloadNode, preload = grid.preload,
			lastScrollTop = grid.lastScrollTop,
			bufferRows = grid.bufferRows,
			searchBuffer = (grid.bufferRows - 1) * grid.rowHeight; // Avoid rounding causing multiple queries
		
		// XXX: I do not know why this happens.
		// munging the actual location of the viewport relative to the preload node by a few pixels in either
		// direction is necessary because at least WebKit on Windows seems to have an error that causes it to
		// not quite get the entire element being focused in the viewport during keyboard navigation,
		// which means it becomes impossible to load more data using keyboard navigation because there is
		// no more data to scroll to to trigger the fetch.
		// 1 is arbitrary and just gets it to work correctly with our current test cases; don’t wanna go
		// crazy and set it to a big number without understanding more about what is going on.
		// wondering if it has to do with border-box or something, but changing the border widths does not
		// seem to make it break more or less, so I do not know…
		var mungeAmount = 1;
		
		grid.lastScrollTop = visibleTop;

		function removeDistantNodes(preload, distanceOff, traversal, below){
			// we check to see the the nodes are "far off"
			var farOffRemoval = grid.farOffRemoval,
				preloadNode = preload.node;
			// by checking to see if it is the farOffRemoval distance away
			if(preloadNode.offsetParent // make sure we are connected to the DOM
					&& distanceOff > 2 * farOffRemoval){
				// ok, there is preloadNode that is far off, let's remove rows until we get to in the current viewpoint
				var row, nextRow = preloadNode[traversal];
				var reclaimedHeight = 0;
				var count = 0;
				var toDelete = [];
				while((row = nextRow)){
					var rowHeight = grid._calcRowHeight(row);
					if(row.betweenRow){
						// skip in between rows
						row = row[traversal];
					}
					if(!row || reclaimedHeight + rowHeight + farOffRemoval > distanceOff || (row.className.indexOf("dgrid-row") < 0 && row.className.indexOf("dgrid-loading") < 0)){
						// we have reclaimed enough rows or we have gone beyond grid rows, let's call it good
						break;
					}
					var nextRow = row[traversal]; // have to do this before removing it
					if(nextRow && nextRow.betweenRow){
						// skip in between rows
						nextRow = nextRow[traversal];
					}
					var lastObserverIndex, currentObserverIndex = row.observerIndex;
					if(currentObserverIndex != lastObserverIndex && lastObserverIndex > -1){
						// we have gathered a whole page of observed rows, we can delete them now
						var observers = grid.observers; 
						var observer = observers[lastObserverIndex]; 
						observer && observer.cancel();
						observers[lastObserverIndex] = 0; // remove it so we don't call cancel twice
					}
					var queryResults = row.queryResults;
					if(queryResults){
						// if we remove a dgrid loading node, we cancel the associated query that is being executed
						queryResults.cancel();
					}
					reclaimedHeight += rowHeight;
					count += row.count || 1;
					lastObserverIndex = currentObserverIndex;
					// we just do cleanup here, as we will do a more efficient node destruction in the setTimeout below
					grid.removeRow(row, true);
					toDelete.push(row);
				}
				// now adjust the preloadNode based on the reclaimed space
				preload.count += count;
				if(below){
					preloadNode.rowIndex -= count;
				}
				// calculate the change in exact row changes, which we must do to not mess with the scrolling
				preloadNode.style.height = (preloadNode.offsetHeight + reclaimedHeight) + "px";
				// we remove the elements after expanding the preload node so that the contraction doesn't alter the scroll position
				if(toDelete.length){
					var trashBin = put("div");
					for(var i = 0; i < toDelete.length; i++){
						put(trashBin, toDelete[i]); // remove it from the DOM
					}
					setTimeout(function(){
						// we can defer the destruction until later
						put(trashBin, "!");
					},1);
				}
			}
			preload = preload[below ? "next" : "previous"];
			if(preload){
				preloadNode = preload.node;
				below ?
					removeDistantNodes(preload, preloadNode.offsetTop - visibleBottom, traversal, true) :
					removeDistantNodes(preload, visibleTop - (preloadNode.offsetTop + preloadNode.offsetHeight), traversal);
			}
		}
		
		function adjustHeight(preload, noMax){
			preload.node.style.height = Math.min(preload.count * grid.rowHeight, noMax ? Infinity : grid.maxEmptySpace) + "px";
		}
		// there can be multiple preloadNodes (if multiple queries are created),
		//	so we can traverse them until we find whatever is in the current viewport, making
		//	sure we don't backtrack
		var nextPreload = preload;
		while((preload = preload.previous)){
			nextPreload = preload;
		}
		while((preload = nextPreload)){
			nextPreload = preload.next;
			preloadNode = preload.node;
			var preloadTop = preloadNode.offsetTop;
			var preloadHeight;
			
			if(visibleBottom + mungeAmount + searchBuffer < preloadTop){
				// the preload is below the line of sight
			}else if(visibleTop - mungeAmount - searchBuffer > (preloadTop + (preloadHeight = preloadNode.offsetHeight))){
				// the preload is above the line of sight
			}else if(preloadNode.offsetWidth){
				// the preload node is visible, or close to visible, better show it
				var offset = preloadNode.bottom ? (visibleTop - preloadTop) / grid.rowHeight :
						visibleTop ? preload.count + (visibleBottom - preloadNode.offsetHeight) / grid.rowHeight : 0;
				var count = (visibleBottom - visibleTop) / grid.rowHeight + bufferRows + 1;
				// utilize momentum for predictions
				var momentum = Math.max(Math.min((visibleTop - lastScrollTop) * grid.rowHeight, grid.maxRowsPerPage/2), grid.maxRowsPerPage/-2);
				count += Math.min(Math.abs(momentum), 10);
				if(!preloadNode.bottom){
					// at the top, adjust from bottom to top
					offset -= count;
				}
				// must do this after so we have buffer on both sides when scrolling up
				count += bufferRows + 1;
				offset = Math.max(offset, 0);
				if(offset < 10 && offset > 0 && count + offset < grid.maxRowsPerPage){
					// connect to the top of the preloadNode if possible to avoid excessive adjustments
					count += Math.max(0, offset);
					offset = 0;
				}
				count = Math.min(Math.max(count, grid.minRowsPerPage),
									grid.maxRowsPerPage, preload.count);
				if(count == 0){
					preload = preload.next == priorPreload ? preload.previous : preload.next;
					continue;
				}
				count = Math.ceil(count);
				offset = Math.min(Math.floor(offset), preload.count - count);
				var options = lang.mixin(grid.get("queryOptions"), preload.options),
					priorCount = preload.count;
				preload.count -= count;
				var beforeNode = preloadNode,
					keepScrollTo = false, queryRowsOverlap = grid.queryRowsOverlap,
					originalScrollHeight = scrollNode.scrollHeight,
					below = preloadNode.bottom && preload; 
				if(below){
					// add new rows below
					var previous = preload.previous;
					if(previous){
						removeDistantNodes(previous, visibleTop - (previous.node.offsetTop + previous.node.offsetHeight), 'nextSibling');
						if(offset > 0 && previous.node == preloadNode.previousSibling){
							// all of the nodes above were removed
							offset = Math.min(preload.count, offset);
							preload.previous.count += offset;
							adjustHeight(preload.previous, true);
							preload.count -= offset;
							preloadNode.rowIndex += offset;
							queryRowsOverlap = 0;
						}else{
							count += offset;
							preload.count -= offset;
						}
					}
					options.start = Math.max(preloadNode.rowIndex - queryRowsOverlap, 0);
					preloadNode.rowIndex += count;
				}else{
					// add new rows above
					if(preload.next){
						// remove out of sight nodes first
						removeDistantNodes(preload.next, preload.next.node.offsetTop - visibleBottom, 'previousSibling', true);
						var beforeNode = preloadNode.nextSibling;
						if(beforeNode == preload.next.node){
							// all of the nodes were removed, can position wherever we want
							preload.next.count += preload.count - offset;
							preload.next.node.rowIndex = offset + count;
							adjustHeight(preload.next);
							queryRowsOverlap = 0;
						}else{
							keepScrollTo = true;
							count = priorCount - offset;
						}
					}
					options.start = preload.count = offset;
				}
				options.count = count + queryRowsOverlap;
				if(keepScrollTo){
					keepScrollTo = beforeNode.offsetTop;
				}
				// create a loading node as a placeholder while the data is loaded
				var loadingNode = put(beforeNode, "-div.dgrid-loading");
				if(preload.count){
					loadingNode.style.height = (count * grid.rowHeight) + "px";
					preload.node.style.height = (preloadNode.offsetHeight + (preload.count - priorCount) * grid.rowHeight) + "px";
				}else{
					// we are contiguous with the end, make sure we replacing the loading with a better estimate of the preload height
					// since the preload node now represents zero rows, it should be zero height, and then we set the loading node to be the correct height that will retain the scroll height
					loadingNode.style.height = "0px";
					loadingNode.style.height = (originalScrollHeight - scrollNode.scrollHeight + preloadNode.offsetHeight) + "px";
					preload.node.style.height = "0px";
				}
				put(loadingNode, "div.dgrid-" + (below ? "below" : "above"), grid.loadingMessage);
				loadingNode.count = count;
				// use the query associated with the preload node to get the next "page"
				options.query = preload.query;
				// Query now to fill in these rows.
				// Keep _trackError-wrapped results separate, since if results is a
				// promise, it will lose QueryResults functions when chained by `when`
				var results = preload.query(options),
					trackedResults = grid._trackError(function(){ return results; });
				loadingNode.queryResults = results;
				if(trackedResults === undefined){ return; } // sync query failed

				// Isolate the variables in case we make multiple requests
				// (which can happen if we need to render on both sides of an island of already-rendered rows)
				(function(loadingNode, scrollNode, below, keepScrollTo, results, preload){
					Deferred.when(grid.renderArray(results, loadingNode, options), function(){
						// can remove the loading node now
						beforeNode = loadingNode.nextSibling;
						put(loadingNode, "!");
						if(keepScrollTo && beforeNode){ // beforeNode may have been removed if the query results loading node was a removed as a distant node before rendering 
							// if the preload area above the nodes is approximated based on average
							// row height, we may need to adjust the preload area once they are filled in
							// so we don't "jump" in the scrolling position

							if(preload.node.offsetHeight){
								preload.node.style.height = Math.max(preload.node.offsetHeight + keepScrollTo - beforeNode.offsetTop, 0) + "px";
							}
						}
						if(below){
							// if it is below, we will use the total from the results to update
							// the count of the last preload in case the total changes as later pages are retrieved
							// (not uncommon when total counts are estimated for db perf reasons)
							Deferred.when(results.total || results.length, function(total){
								// recalculate the count
								below.count = total - below.node.rowIndex;
								// readjust the height
								adjustHeight(below);
							});
						}
					});
				}).call(this, loadingNode, scrollNode, below, keepScrollTo, results, preload);
				preload = preload.previous;
			}
		}
	}
});

});
