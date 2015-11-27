/*
 * http://blog.nparashuram.com/2015/03/performance-comparison-on-javascript.html
 */

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

function domSet(el, prop, value) {
  if( el[prop] !== value) {
    el[prop] = value;
  }
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
    /* Put as many views as possible in a single animation frame */
    var update = RenderScheduler.createTask(this, "update");
    /* One animation frame per view
    var view = this, update = _.debounce(function() {
      window.requestAnimationFrame(function() { view.update(); });
    }, 50);*/
    /* No animation frame
    var update = _.debounce(_.bind(this.update, this), 100);*/
    this.listenTo(this.model,         "change", update);
    this.listenTo(this.model.queries, "change", update);
  },
  /**
   * Render will only be executed once in the view life cycle
   */
  render: function() {
    this.el.innerHTML = document.getElementById("table-row").innerHTML;
    this.cacheDOMElements();
    this.update();
    return this;
  },
  /**
   * Get a map of the elements we need to modify
   */
  cacheDOMElements: function() {
    var rows = this.el.querySelectorAll("td.Query");
    this.dom = {
      "dbname": this.el.querySelector(".dbname"),
      "qryCount": this.el.querySelector(".query-count > span"),
      "rows": _.map(rows, function(el) {
        return {
          "el": el,
          "elapsed": el.querySelector("span"),
          "popover": el.querySelector(".popover-content"),
        };
      })
    };
  },
  /**
   * Instead of replace the hole html content, just manually update each element
   */
  update: function() {
    var l, i, row, dta, rows, data;
    data = this.model.toJSON();

/* Modify only if value changed, use cached DOM elements
    domSet(this.dom.dbname, "textContent", data.name);
    domSet(this.dom.qryCount, "className", data.countClassName);
    domSet(this.dom.qryCount, "textContent", data.numQueries);
    rows = this.dom.rows;
    this.model.queries.each(function(query, idx) {
      dta = query.toJSON();
      row = rows[idx];
      domSet(row.el, "className", dta.className);
      domSet(row.elapsed, "textContent", dta.elapsed);
      domSet(row.popover, "textContent", dta.query);
    });*/

/* Modify all values, use cached DOM elements*/
    //this.cacheDOMElements(); // do not cache
    this.dom.dbname.textContent   = data.name;
    this.dom.qryCount.className   = data.countClassName;
    this.dom.qryCount.textContent = data.numQueries;
    rows  = this.dom.rows;
    for(i = 0, l = this.model.queries.length; i < l; ++i) {
      dta = this.model.queries.at(i).toJSON();
      row = rows[i];
      row.el.className        = dta.className;
      row.elapsed.textContent = dta.elapsed;
      row.popover.textContent = dta.query;
    }

/* Use jquery to modify DOM **SLOW**
    this.$(".dbname").text( this.model.get("name"));
    this.$(".query-count span").attr("class", this.model.get("countClassName")).text( this.model.get("numQueries"));
    var $rows = this.$("td");
    this.model.queries.each(function(query, idx) {
      $rows.eq(idx + 2)
          .attr("class", query.get("className"))
          .find("span")
            .text(query.get("elapsed"))
            .end()
          .find(".popover-content")
            .text(query.get("query"));
    });*/
  }
});

var QueryItemModel = Backbone.Model.extend({
  defaults: {
    className: "",
    elapsed:   "",
    query:     ""
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


var MUTATIONS = 0.5;
var N = 50;

document.addEventListener('DOMContentLoaded', function() {
  var dbs = new DatabaseList(N);

  var sliderContainer = document.createElement('div');
  sliderContainer.style.display = 'flex';
  var slider = document.createElement('input');
  slider.type = 'range';
  slider.style.marginBottom = '10px';
  slider.style.marginTop = '5px';
  var text = document.createElement('label');
  text.textContent = 'mutations : ' + (MUTATIONS * 100).toFixed(0) + '%';

  slider.addEventListener('change', function(e) {
    MUTATIONS = e.target.value / 100;
    text.textContent = 'mutations : ' + (MUTATIONS * 100).toFixed(0) + '%';
  });
  sliderContainer.appendChild(text);
  sliderContainer.appendChild(slider);
  document.body.insertBefore(sliderContainer, document.body.firstChild);

  var container = document.getElementById('dbmon');

  var collection = new DBCollection();
  var views = [];
  var table = document.querySelector("#dbmon table tbody");

  function update() {
    dbs.randomUpdate(MUTATIONS);
    // The trick here is to assign ids to the db items and 
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