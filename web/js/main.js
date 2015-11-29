/*
 * http://blog.nparashuram.com/2015/03/performance-comparison-on-javascript.html
 * https://www.npmjs.com/package/browserify-handlebars
 * $>browserify -t browserify-handlebars main.js -o ../bundle.js
 */

//var $           = require("zepto-browserify").$;
var $           = require("jquery");
var _           = require("lodash");
var Backbone    = require("backbone");
var CONFIG      = require("./config.js");
var ConfigPanel = require("./configPanel.js");
var dbRowTemplate  = require("../dbRow.handlebars");
var IncrementalDOM = require('incremental-dom');
var VirtualDOM     = require('virtual-dom');

function formatElapsed(v) {
  if (!v) return '';

  var str = parseFloat(v).toFixed(2);

  if (v > 60) {
    var minutes = Math.floor(v / 60);
    var comps = (v % 60).toFixed(2).split('.');
    var seconds = comps[0];
    var ms = comps[1];
    str = minutes + ':' + seconds + '.' + ms;
  }

  return str;
}

function counterClasses(count) {
  if (count >= 20) {
    return 'label label-important';
  } else if (count >= 10) {
    return 'label label-warning';
  }
  return 'label label-success';
}

function queryClasses(elapsed) {
  if (elapsed >= 10.0) {
    return 'Query elapsed warn_long';
  } else if (elapsed >= 1.0) {
    return 'Query elapsed warn';
  }
  return 'Query elapsed short';
}

/**
   * Render Scheduler to render views in an animation Frame.
   * ensures each render method is called only once per view.
   */
  var RenderScheduler = {
      waiting:   {},
      pending:   [],
      frameId: null,

      /**
       * Schedule a view to be rendered, if it was scheduled before
       * the previous entry will be deleted.
       */
      add: function(view, method, args) {
        // Skip if the view is already waiting to be rendered
        if( this.waiting[view.cid]) { return; }

        // Add to the queue
        this.waiting[view.cid] = true;
        this.pending.push({
          view:   view,
          method: view[method],
          args:   args
        });        

        // Request an animation frame
        if (!this.frameId) {
          this.frameId = window.requestAnimationFrame(this.process);
        }
      },

      createTask: function(view, method, args) {
        return function() {
          RenderScheduler.add(view, method, args);
        }
      },

      /**
       * Render all pending views
       */
      process: function() {
        var data, count = 0;
        while (this.pending.length) {
          data = this.pending.shift();
          data.method.apply( data.view, data.args);
          this.waiting[data.view.cid] = false;
          ++count;
        }
        this.frameId = null;
        //console.log("RenderScheduler::processed: " + count)
      }
  };
  // Bind the process function to the scheduler
  RenderScheduler.process = _.bind(RenderScheduler.process, RenderScheduler);

var DBTableRowView = Backbone.View.extend({
  tagName: "tr",
  initialize: function() {

    var view = this, update = function() {
      if (CONFIG.reqAnimFrm) {
        // Put as many views as possible in a single animation frame
        RenderScheduler.add(view, "update");
      } else {
        view.update();
      }
    };

    this.listenTo(this.model,         "change", update);
    this.listenTo(this.model.queries, "change", update);
  },

  /**
   * Render will only be executed once in the view life cycle
   */
  render: function() {
    if (CONFIG.render === "Handlebars") {
      this.handlebarsRender();
      return this;
    }

    if (CONFIG.render === "iDOM" || CONFIG.render === "vDOM") {
      this.update();
      return this;
    }

    this.el.innerHTML = document.getElementById("table-row").innerHTML;
    this.update();
    return this;
  },

  handlebarsRender: function() {
    var view = this.model.toJSON();
    view.queries = this.model.queries.toJSON();
    this.el.innerHTML = dbRowTemplate(view);
  },

  incrementalDOMRender: function() {
    var elementOpen  = IncrementalDOM.elementOpen,
      elementClose = IncrementalDOM.elementClose,
      text         = IncrementalDOM.text,
      data         = this.model.toJSON(),
      queries      = this.model.queries.toJSON();

    elementOpen("td", "", ["class", "dbname"]);
      text(data.name);
    elementClose("td");

    elementOpen("td", "", ["class", "query-count"]);
      elementOpen("span", "", null, "class", data.countClassName);
        text(data.numQueries);
      elementClose("span");
    elementClose("td");

    queries.forEach(function(query) {
      elementOpen("td", "", null, "class", "Query " + query.className);
        elementOpen("span", "", null);
          text(query.elapsed);
        elementClose("span");
        elementOpen("div", "", ["class", "popover left"]);
          elementOpen("div", "", ["class", "popover-content"]); 
            text(query.query);
          elementClose("div");
          elementOpen("div", "", ["class", "arrow"]);
          elementClose("div");
        elementClose("div");
      elementClose("td");
    });
  },

  virtualDOMInit: function() {
    this.vDOMTree     = this.virtualDOMRender();
    var rootNode      = VirtualDOM.create(this.vDOMTree);
    this.el.innerHTML = rootNode.innerHTML;
  },

  virtualDOMRender: function() {
    var h     = VirtualDOM.h,
      data    = this.model.toJSON(),
      queries = this.model.queries.toJSON(),
      elems   = [];

    elems.push(h("td.dbname", [data.name]));
    elems.push(h("td.query-count",[
      h("span." + data.countClassName.replace(" ", "."), [data.numQueries])
    ]));

    _.forEach(queries, function(query, idx) {
      elems.push(h("td.Query." + query.className.replace(" ", "."), {"key": idx}, [
        h("span", [query.elapsed]),
        h("div.popover.left",[
          h("div.popover-content", [query.query]),
          h("div.arrow")
        ])
      ]));
    });

    return h("tr", {"key": this.model.id}, elems);
  },

  /**
   * Get a map of the elements we need to modify
   */
  cacheDOMElements: function() {
    this.dom = {
      "dbname": this.el.querySelector(".dbname"),
      "qryCount": this.el.querySelector(".query-count > span"),
      "rows": _.map(this.el.querySelectorAll("td.Query"), function(el) {
        return {
          "el": el,
          "elapsed": el.querySelector("span"),
          "popover": el.querySelector(".popover-content")
        };
      })
    };
  },

  cachejQueryElems: function() {
    this.$dom = {
      "$dbname":   this.$(".dbname"),
      "$qryCount": this.$(".query-count > span"),
      "$rows":     _.map(this.$("td.Query"), function(el) {
        var $el = $(el);
        return {
          "$el": $el,
          "$elapsed": $el.find("span"),
          "$popover": $el.find(".popover-content")
        };
      })
    };
  },

  clearCache: function() {
    this.$dom      = null;
    this.dom       = null;
    this.vDOMTree  = null;
  },

  /**
   * Instead of replace the hole html content, just manually update each element
   */
  update: function() {
    var data;
    if (CONFIG.render === "Handlebars") {
      this.handlebarsRender();
      return;
    }

    if (CONFIG.render === "iDOM") {
      IncrementalDOM.patch(this.el, $.proxy(this, "incrementalDOMRender"));
      return;
    }

    if (CONFIG.render === "vDOM") {
      this.virtualDOMUpdate();
      return;
    }

    data = this.model.toJSON();

    if (CONFIG.render === "jQuery") {
      this.jQueryUpdate(data);
    }
    else if (CONFIG.render === "DOM"){
      this.domUpdate(data);
    }
  },

  jQueryUpdate: function(data) {
    var i, l, qry, row;
    if( !this.$dom) {
      this.cachejQueryElems();
    }

    this.$dom.$dbname.text( data.name);
    this.$dom.$qryCount
            .attr("class", data.countClassName)
            .text( data.numQueries);

    for(i = 0, l = this.model.queries.length; i < l; ++i) {
      qry = this.model.queries.at(i).toJSON();
      $row = this.$dom.$rows[i];
      $row.$el.attr("class", qry.className);
      $row.$elapsed.text( qry.elapsed)
      $row.$popover.text( qry.query);
    }

    if( CONFIG.cacheElems === false) {
      this.$dom = null;
    }
  },

  domUpdate: function(data) {
    var i, l, qry, row;
    if( !this.dom) {
      this.cacheDOMElements();
    }

    this.dom.dbname.textContent   = data.name;
    this.dom.qryCount.className   = data.countClassName;
    this.dom.qryCount.textContent = data.numQueries;

    for(i = 0, l = this.model.queries.length; i < l; ++i) {
      qry = this.model.queries.at(i).toJSON();
      row = this.dom.rows[i];
      row.el.className        = qry.className;
      row.elapsed.textContent = qry.elapsed;
      row.popover.textContent = qry.query;
    }    

    if( CONFIG.cacheElems === false) {
      this.dom = null;
    }
  },

  virtualDOMUpdate: function() {
    var newTree, patches, element;
    if (!this.vDOMTree) {
      this.virtualDOMInit();
      return;
    }
    newTree = this.virtualDOMRender();
    patches = VirtualDOM.diff(this.vDOMTree, newTree);
    element = VirtualDOM.patch(this.el, patches);
    //this.setElement(element);
    this.vDOMTree = newTree;
  }
});

var QueryItemModel = Backbone.Model.extend({
  defaults: {
    "className": "",
    "elapsed":   "",
    "query":     ""
  },
  parse: function(data) {
    return {
      className: queryClasses(data.elapsed),
      elapsed:   formatElapsed(data.elapsed),
      query:     data.query
    }
  }
});

QueryCollection = Backbone.Collection.extend({
  model: QueryItemModel
});


var DBModel = Backbone.Model.extend({
  defaults: {
    "name": "",
    "numQueries": "",
    "countClassName": ""
  },
  initialize: function() {
    this.initNestedModels();
  },
  parse: function(data) {
    this.initNestedModels();
    this.queries.set(data.getTopFiveQueries(), {parse: true});
    return {
      id:   data.id,
      name: data.name,
      numQueries: data.queries.length,
      countClassName: counterClasses(data.queries.length)
    };
  },
  initNestedModels: function() {
    if( !this.queries) {
      this.queries = new QueryCollection();
    }
  }
});

DBCollection = Backbone.Collection.extend({
  model: DBModel
});

document.addEventListener('DOMContentLoaded', function() {
  var dbs = new DatabaseList(CONFIG.numDbs);
  var collection = new DBCollection();
  var views = [];
  var table = document.querySelector("#dbmon table tbody");
  var render = CONFIG.render;
  var cfgPanel = new ConfigPanel({ el:"#config-panel" });

  cfgPanel.on("change:render", function() {
    if( CONFIG.render !== "Handlebars") {
      _.invoke(views, "clearCache");
    }
  });

  window.CONFIG = CONFIG;

  function update() {
    // The trick here is to assign ids to the db items and 
    dbs.randomUpdate(CONFIG.mutations);
    // pass them to backbone to do the parsing/dirty checking
    _.each(dbs.dbs, function(db, idx){ db.id = idx + 1;});
    collection.set(dbs.dbs, {parse: true});

    // Instantiate all row views, this is executed only one time,
    // After the views are created, the model changes will trigger updates
    var view, idx = 0;
    while(views.length < collection.length) {
      view = new DBTableRowView({ model: collection.at(idx++) });
      views.push(view);
      table.appendChild(view.render().el);
    }

    window.Monitoring.renderRate.ping();
    setTimeout(update, 0);
  }

  setTimeout(update, 0);
});