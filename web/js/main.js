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
var RenderScheduler = require("./RenderScheduler.js");

require("./ENV.js");

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
  parse: function(q) {
    return {
      id:        q.id,
      className: q.elapsedClassName || "Query",
      elapsed:   q.formatElapsed || "",
      query:     q.query || ""
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
  constructor: function(attrs, options) {
    this.queries = new QueryCollection();
    Backbone.Model.call(this, attrs, options);
  },
  parse: function(db) {
    _.each(db.lastSample.topFiveQueries, function(q, idx){ q.id = idx; });
    this.queries.set(db.lastSample.topFiveQueries, {parse: true});
    return {
      id:             db.id,
      name:           db.dbname,
      numQueries:     db.lastSample.nbQueries,
      countClassName: db.lastSample.countClassName
    };
  }
});

DBCollection = Backbone.Collection.extend({
  model: DBModel
});

document.addEventListener('DOMContentLoaded', function() {
  //var dbs = new DatabaseList(CONFIG.numDbs);
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

  window.CONFIG     = CONFIG;
  window.optimize   = false;
  window.collection = collection;

  function update() {
    var dbs, view, idx = 0;

    dbs = ENV.generateData().toArray(window.optimize);
    // The trick here is to assign ids to the db items and 
    // pass them to backbone to do the parsing/dirty checking
    _.each(dbs, function(db, idx){ db.id = idx + 1;});
    collection.set(dbs, {parse: true});

    // Instantiate all row views, this is executed only one time,
    // After the views are created, the model changes will trigger updates
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