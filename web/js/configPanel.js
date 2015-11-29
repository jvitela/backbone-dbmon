var $ = require("jquery");
var _ = require("lodash");
var Backbone = require("backbone");
var CONFIG   = require("./config.js");

var ConfigPanel = Backbone.View.extend({
  events: {
    "change input": "onInputChange"
  },
  initialize: function(options) {
    this.$text       = this.$(".text");
    this.$mutations  = this.$("input[name=mutations]");
    this.$render     = this.$("input[name=render]");
    this.$cacheElems = this.$("input[name=cacheElems]");
    this.$reqAnimFrm = this.$("input[name=reqAnimFrm]");
    this.render();
  },
  onInputChange: function(event) {
    var input = event.currentTarget;
    switch( input.name) {
      case "mutations":
        CONFIG.mutations = input.value / 100;
        break;
      case "render":
        if( !input.checked) { 
          return; 
        }
        CONFIG.render = input.value;
        if (!this.canUseCache()) {
          CONFIG.cacheElems = false;
        }
        this.trigger("change:render");
        break;
      case "cacheElems":
      case "reqAnimFrm":
        CONFIG[input.name] = input.checked;
        break;
    }
    this.render();
  },
  canUseCache: function() {
    return (CONFIG.render === "jQuery" || CONFIG.render === "DOM");
  },
  render: function() {
    var mutations = (CONFIG.mutations * 100);
    this.$text.text(mutations.toFixed(0));
    this.$mutations.val(mutations)
    this.$render.val([CONFIG.render]);
    this.$cacheElems.prop("checked", CONFIG.cacheElems);
    this.$reqAnimFrm.prop("checked", CONFIG.reqAnimFrm);
    this.$cacheElems.prop("disabled", !this.canUseCache());
  }
});

module.exports = ConfigPanel;