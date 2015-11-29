(function() {
  var template = Handlebars.template, templates = Handlebars.templates = Handlebars.templates || {};
templates['dbRow'] = template({"1":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : {}, alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "<td class=\"Query "
    + alias4(((helper = (helper = helpers.className || (depth0 != null ? depth0.className : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"className","hash":{},"data":data}) : helper)))
    + "\">\r\n  "
    + alias4(((helper = (helper = helpers.elapsed || (depth0 != null ? depth0.elapsed : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"elapsed","hash":{},"data":data}) : helper)))
    + "\r\n  <div class=\"popover left\">\r\n    <div class=\"popover-content\">"
    + alias4(((helper = (helper = helpers.query || (depth0 != null ? depth0.query : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"query","hash":{},"data":data}) : helper)))
    + "</div>\r\n    <div class=\"arrow\"></div>\r\n  </div>\r\n</td>\r\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : {}, alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "<td class=\"dbname\">\r\n  "
    + alias4(((helper = (helper = helpers.name || (depth0 != null ? depth0.name : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data}) : helper)))
    + "\r\n</td>\r\n<td class=\"query-count\">\r\n	<span class=\""
    + alias4(((helper = (helper = helpers.countClassName || (depth0 != null ? depth0.countClassName : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"countClassName","hash":{},"data":data}) : helper)))
    + "\">"
    + alias4(((helper = (helper = helpers.numQueries || (depth0 != null ? depth0.numQueries : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"numQueries","hash":{},"data":data}) : helper)))
    + "</span>\r\n</td>\r\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.queries : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "");
},"useData":true});
})();