(function() {

var nuRepository = ['$injector', '$q', '$state', '$stateParams',
    function ($injector,   $q,   $state,   $stateParams) {
        function nuRepository(ResourceName) {
            var self = this;
            self._resource = $injector.get(ResourceName);
            self.isLoading = false;
            self.params = {};
            self.idKey = 'id';
            self.viewState = '.view';

            self.current_page = 1;
            self.per_page = 15;
            self.include = [];
            self.promise = null;

            self.setResource = function (ResourceName) {
                self._resource = $injector.get(ResourceName);
            };

            self.load = function () {
                self.getPaginated();
            };

            self.getPaginated = function(queryParams) {
                var query = angular.copy(queryParams || {});
                angular.extend(query, self.params, {
                    page: {
                        size: self.per_page,
                        number: self.current_page
                    },
                    include: self.include
                });
                self.promise = self.paginate(query);
                self.promise.then(function(data) {
                    self.data = data;
                    if(data.meta) self.total = data.meta.total;
                });
            };

            self.onPaginate = function (page, limit) {
                ctrl.current_page = page;
                ctrl.per_page = limit;
                self.getPaginated();
            };

            self.view = function(id){
                var viewParams = {};
                viewParams[self.idKey] = id;
                $state.go(self.viewState, viewParams);
            };

            self.search = function (query, extraParams) {
                var params = angular.extend({}, extraParams);
                if(query) params.filter = { query: query };
                return self._resource.search(params).$promise;
            };

            self.sanitizedSearch = function (query, extraParams) {
                var defer = $q.defer();

                self.search(query, extraParams).then(function (data) {
                    defer.resolve(data.data);
                });

                return defer.promise;
            };

            self.paginate = function (queryParams) {
                if(queryParams && queryParams.include)
                    queryParams.include = self.serializeIncludes(queryParams.include);
                return self._resource.query(queryParams).$promise;
            };

            self.get = function (id, includes, extraParams) {
                var params = {
                    id: id
                };
                angular.extend(params, extraParams);

                if (includes) params.include = self.serializeIncludes(includes);

                return self._resource.get(params).$promise;
            };

            self.store = function (data, params) {
                var result = null;
                if(params) result = self._resource.save(params, data).$promise;
                else       result = self._resource.save(data).$promise;
                return result;
            };

            self.update = function (id, data, extraParams) {
                var params = angular.extend({id: id}, extraParams);
                return self._resource.update(params, data).$promise;
            };

            self.delete = function (id, extraParams) {
                var params = angular.extend({id: id}, extraParams);
                return self._resource.delete(params).$promise;
            };

            self.serializeIncludes = function (includes) {
                var result = '';
                angular.forEach(includes, function (value) {
                    result += result == '' ? value : ',' + value;
                });
                return result;
            };
        }
        return nuRepository;
    }
];

var nuJsonApiResponseTransformer = [
    function () {
        return function (jsonApiData, headers) {
            if(angular.isUndefined(jsonApiData.included)) return jsonApiData;

            var raw = angular.copy(jsonApiData);
            var sanitized = {};

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