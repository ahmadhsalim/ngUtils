(function() {


var nuRepository = ['$injector', '$q', '$state', '$stateParams',
  function ($injector,   $q,   $state,   $stateParams) {
    return function (source, ResourceName, options) {
      source.prototype._resource = $injector.get(ResourceName);
      source.prototype.ResourceName = ResourceName;

      source.prototype.current_page = 1;
      source.prototype.per_page = 6;
      source.prototype.include = [];
      source.prototype.params = {};
      source.prototype.options = options || {};
      source.prototype.idKey = source.prototype.options.idKey || 'id';
      source.prototype.viewState = source.prototype.options.viewState || '.view';
      source.prototype.updateState = source.prototype.options.updateState || '.update';
      source.prototype.promise = null;

      source.prototype.setResource = function (ResourceName) {
        source.prototype._resource = $injector.get(ResourceName);
      };

      source.prototype.getPaginated = function(queryParams) {
        var query = angular.copy(queryParams || {});
        angular.extend(query, source.prototype.params, {
          page: {
            number: source.prototype.current_page,
            size: source.prototype.per_page
          }
        });
        source.prototype.promise = source.prototype.paginate(query);
        source.prototype.promise.then(function(response) {
          source.prototype.response = response;
          source.prototype.response = response;
          if(response.per_page) source.prototype.per_page = response.per_page;
          if(response.current_page) source.prototype.current_page = response.current_page;
          if(response.total) source.prototype.total = response.total;
        });
        return source.prototype.promise;
      };

      source.prototype.onPaginate = function (page, limit) {
        source.prototype.current_page = page;
        source.prototype.per_page = limit;
        source.prototype.getPaginated();
      };

      source.prototype.viewPage = function(id){
        var viewParams = {};
        viewParams[source.prototype.idKey] = id;
        $state.go(source.prototype.viewState, viewParams);
      };

      source.prototype.updatePage = function(id){
        var updateParams = {};
        $state.go(source.prototype.updateState, updateParams);
      };

      source.prototype.paginate = function (queryParams) {
        source.prototype.isListLoading = true;
        source.prototype.promise = source.prototype._resource.query(queryParams).$promise;
        source.prototype.promise.then(function() {
          source.prototype.isListLoading = false;
        });
        return source.prototype.promise;
      };

      source.prototype.autocomplete = function (query, queryParams) {
        source.prototype.isAutoCompleteLoading = true;

        var defer = $q.defer();
        var params = angular.extend({q:query}, queryParams);
        source.prototype.promise = source.prototype.paginate(params);
        source.prototype.promise.then(function(response) {
          defer.resolve(response.data);
          source.prototype.isAutoCompleteLoading = false;
        });
        return defer.promise;
      };

      source.prototype.get = function (id, includes, extraParams) {
        source.prototype.isGetLoading = true;
        
        var params = {
          id: id
        };
        angular.extend(params, extraParams);

        if (includes) params.include = source.prototype.serializeIncludes(includes);

        source.prototype.promise = source.prototype._resource.get(params).$promise;
        source.prototype.promise.then(function() {
          source.prototype.isGetLoading = false;
        });
        return source.prototype.promise;
      };

      source.prototype.store = function (data, params) {
        source.prototype.isStoreLoading = true;

        var result = null;
        if(params) result = source.prototype._resource.save(params, data).$promise;
        else       result = source.prototype._resource.save(data).$promise;
        source.prototype.promise = result;
        source.prototype.promise.then(function() {
          source.prototype.isStoreLoading = false;
        });
        return result;
      };

      source.prototype.load = function (params) {
          return source.prototype.getPaginated(params);
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
            var sanitized = angular.copy(raw);

            if(angular.isArray(raw.data)) raw.included = raw.included.concat(raw.data);
            else raw.included.push(raw.data);

            raw.included.forEach(function(resource) {
                if(angular.isUndefined(sanitized[resource.type])) sanitized[resource.type] = {};
                sanitized[resource.type][resource.id] = resource;
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