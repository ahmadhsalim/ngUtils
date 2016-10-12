(function() {


var nuRepository = ['$injector', '$q', '$state', '$stateParams',
  function ($injector,   $q,   $state,   $stateParams) {
    return function (source, ResourceName, options) {
      var proto = source.prototype;
      proto._resource = $injector.get(ResourceName);
      proto.ResourceName = ResourceName;

      proto.include = [];
      proto.params = {};
      proto.options = options || {};
      proto.current_page = proto.options.current_page || 1;
      proto.per_page = proto.options.per_page || 15;
      proto.idKey = proto.options.idKey || 'id';
      proto.viewState = proto.options.viewState || '.view';
      proto.updateState = proto.options.updateState || '.update';
      proto.promise = null;

      proto.setResource = function (ResourceName) {
        proto._resource = $injector.get(ResourceName);
      };

      proto.getPaginated = function(queryParams) {
        var query = angular.copy(queryParams || {});
        angular.extend(query, proto.params, {
          page: {
            size: proto.per_page,
            number: proto.current_page
          }
        });
        proto.promise = proto.paginate(query);
        proto.promise.then(function(response) {
          proto.response = response;
          if(response.per_page) proto.per_page = response.per_page;
          if(response.current_page) proto.current_page = response.current_page;
          if(response.total) proto.total = response.total;
        });
        return proto.promise;
      };

      proto.onPaginate = function (page, limit) {
        proto.current_page = page;
        proto.per_page = limit;
        proto.getPaginated();
      };

      proto.viewPage = function(id){
        var viewParams = {};
        viewParams[proto.idKey] = id;
        $state.go(proto.viewState, viewParams);
      };

      proto.updatePage = function(id){
        var updateParams = {};
        $state.go(proto.updateState, updateParams);
      };

      proto.paginate = function (queryParams) {
        proto.isListLoading = true;
        proto.promise = proto._resource.query(queryParams).$promise;
        proto.promise.then(function() {
          proto.isListLoading = false;
        });
        return proto.promise;
      };

      proto.autocomplete = function (query, queryParams) {
        proto.isAutoCompleteLoading = true;

        var defer = $q.defer();
        var params = angular.extend({q:query}, queryParams);
        proto.promise = proto.paginate(params);
        proto.promise.then(function(response) {
          defer.resolve(response.data);
          proto.isAutoCompleteLoading = false;
        });
        return defer.promise;
      };

      proto.get = function (id, includes, extraParams) {
        proto.isGetLoading = true;
        
        var params = {
          id: id
        };
        angular.extend(params, extraParams);

        if (includes) params.include = proto.serializeIncludes(includes);

        proto.promise = proto._resource.get(params).$promise;
        proto.promise.then(function(response) {
          proto.response = response;
          proto.isGetLoading = false;
        });
        return proto.promise;
      };
      proto.update = function (id, data, extraParams) {
        proto.isUpdateLoading = true;
        var params    = {};
        if(id) params = angular.extend({id: id}, extraParams);
        else params   = extraParams;
        var result    = proto._resource.update(params, data).$promise;
        result.then(function(response) {
          proto.response = response;
          proto.isUpdateLoading = false;
        });

        return result;
      };

      proto.store = function (data, params) {
        proto.isStoreLoading = true;

        var result = null;
        if(params) result = proto._resource.save(params, data).$promise;
        else       result = proto._resource.save(data).$promise;
        proto.promise = result;
        proto.promise.then(function(response) {
          proto.response = response;
          proto.isStoreLoading = false;
        });
        return result;
      };

      proto.load = function (params) {
          return proto.getPaginated(params);
      };

      return source;
    };
  }
];

var nuJsonApiResponseTransformer = [
  function () {
    return function (jsonApiData, headers) {
      if(angular.isUndefined(jsonApiData.included)) return jsonApiData;

      var raw = angular.copy(jsonApiData);
      var sanitized = angular.copy(jsonApiData);
      sanitized.included = {};

      if(angular.isArray(raw.data)) raw.included = raw.included.concat(raw.data);
      else raw.included.push(raw.data);

      raw.included.forEach(function(resource) {
        if(angular.isUndefined(sanitized.included[resource.type])) sanitized.included[resource.type] = {};
        sanitized.included[resource.type][resource.id] = resource;
      });

      return sanitized;
    };
  }
];

var nuFocuser = ['$timeout', '$parse',
  function (    $timeout,   $parse) {
    return {
      link: function (scope, element, attrs) {
        var model = $parse(attrs.nuFocuser);
        scope.$watch(model, function(value) {
          if (value === true) {
            $timeout(function() {
              element[0].focus();
            });
          }
        });
      }
    };
  }
];

var nuElement = [
  function () {
    return {
      restrict: 'A',
      scope: {
        nuElement: '='
      },
      link: function (scope, element, attrs) {
        scope.nuElement = element[0];
      }
    }
  }
];

var nuFromNow = ['$window', function ($window) {
  return function (dateString) {
    return $window.moment(new Date(dateString)).fromNow()
  };
}];

var nuDateToYears = ['$window', function ($window) {
  return function (dateString) {
    var now = $window.moment();
    var age = $window.moment(dateString);
    age = now.diff(age, 'months');
    var years = Math.floor(age / 12);
    var months = age % 12;
    years = years == 0 ? "" : years > 1 ? " " + years + " years" : " " + years + " year";

    months = months == 0 ? "" : months > 1 ? " " + months + " months" : " " + months + " month";
    return years + months;
  };
}];

var nuCapitalize = [function() {
  return function(input, all) {
    var reg = (all) ? /([^\W_]+[^\s-]*) */g : /([^\W_]+[^\s-]*)/;
    return (!!input) ? input.replace(reg, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();}) : '';
  }
}];

angular.module('ngUtils', [])
  .factory('nuRepository', nuRepository)
  .factory('nuJsonApiResponseTransformer', nuJsonApiResponseTransformer)

  .directive('nuFocuser', nuFocuser)
  .directive('nuElement', nuElement)

  .filter('nuFromNow', nuFromNow)
  .filter('nuCapitalize', nuCapitalize)
  .filter('nuDateToYears', nuDateToYears);

})();