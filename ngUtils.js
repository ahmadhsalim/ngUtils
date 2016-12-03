(function() {

var nuIdentityProvider = function () {
  var provider = this;
  
  this.$get = ['$injector', '$rootScope', '$filter', '$q', '$timeout', '$filter',
    function(   $injector,   $rootScope,   $filter,   $q,   $timeout,   $filter) {

      if(angular.isUndefined(this.authUserGetter)) console.error('authUserGetter not provider in nuIdentityProvider');
      
      var authUser = $injector.get(this.authUserGetter);

      var _identity = undefined,
        _permissions = undefined,
        _roles = undefined,
        _authenticated = false;

      function sanitizeRolesAndPermissions(included) {
        var list = {
          permissions: {},
          roles: {}
        };

        if(angular.isDefined(included.permissions)){
          angular.forEach(included.permissions, function(item) {
            list.permissions[item.attributes.slug] = angular.isDefined(item.attributes.access) ? item.attributes.access : true;
          });
        }
        if(angular.isDefined(included.roles)){
          angular.forEach(included.roles, function(item) {
            list.roles[item.attributes.slug] = true;
          });
        }
        return list;
      }

      return {
        isResolved: function() {
          return angular.isDefined(_identity);
        },
        isAuthenticated: function() {
          return _authenticated;
        },
        hasPermission: function(permission) {
          return !!_permissions[permission];
        },
        hasRole: function(role) {
          return !!_roles[role];
        },
        hasAnyPermission: function(permissions) {
          for (var i = permissions.length - 1; i >= 0; i--)
            if (this.hasPermission(permissions[i])) return true;

          return false;
        },
        hasAnyRole: function(roles) {
          for (var i = roles.length - 1; i >= 0; i--)
            if (this.hasRole(roles[i])) return true;

          return false;
        },
        getName: function () {
          return _identity.data.attributes.name;
        },
        authenticate: function(identity) {
          if(identity != null){
            _identity      = identity;
            _authenticated = true;
            
            var list       = sanitizeRolesAndPermissions(identity.included);
            _permissions   = list.permissions;
            _roles         = list.roles;

          }else{
            _identity      = null;
            _permissions   = [];
            _authenticated = false;
          }
        },
        identity: function(force) {
          var self     = this;
          var deferred = $q.defer();

          if (force === true) _identity = undefined;
          // check and see if we have retrieved the identity data from the server. if we have, reuse it by immediately resolving
          if (angular.isDefined(_identity)) {
            deferred.resolve(_identity);

            return deferred.promise;
          }

          authUser.get().then(function(data) {
            console.log
            if ( angular.isDefined(data.data) ){
              self.authenticate(data);
              deferred.resolve(data);
            } else {
              _identity = null;
              self.authenticate(null);
              deferred.resolve(data);
            }
          });

          return deferred.promise;
        }
      };
    }
  ];
};

var nuAuthorizationProvider = function() {
  
  this.$get = ['$rootScope', '$state', 'nuIdentity',
    function(   $rootScope,   $state,   nuIdentity) {
      return {
        run: function(toState, toParams, fromState, fromParams) {
          $rootScope.toState    = toState;
          $rootScope.toParams   = toParams;
          $rootScope.lastState  = fromState;
          $rootScope.lastParams = fromParams;

          // if(toState.name != 'guest.signin'){
          //     $rootScope.returnToState = toState.name;
          //     $rootScope.returnToStateParams = toStateParams;
          // }
          // else if(!angular.isDefined($rootScope.returnToState)){
          //     $rootScope.returnToState = 'app.dashboard';
          //     $rootScope.returnToStateParams = {};
          // }

          // if the nuIdentity is resolved, do an Authorization check immediately. otherwise,
          // it'll be done when the state it resolved.
          if (nuIdentity.isResolved()) this.authorize();
          
        },
        authorize: function() {
          var identity = nuIdentity.identity();
          identity.then(function(data) {
            var isAuthenticated = nuIdentity.isAuthenticated();

            if(isAuthenticated){
              if ($rootScope.toState.data.permissions
                && $rootScope.toState.data.permissions.length > 0
                && !nuIdentity.hasAnyPermission($rootScope.toState.data.permissions)){
                
                console.log('show access denied');
                // $state.go('app.access-denied'); // user is signed in but not authorized for desired state
              }
            }else if($rootScope.toState.name !== 'guest.signin'){
              console.log('redirect to sign in');
              // $state.go('guest.signin');
            }
          });

          return identity;
        }
      };
    }
  ];
};

var nuRepositoryProvider = function() {
  var provider = this;

  provider.pagingParamGetter = function (page, limit) {
    return {
      page:{
        number: page,
        size: limit
      }
    };
  };

  provider.$get = ['$injector', '$q', '$state', '$stateParams',
    function   ($injector,   $q,   $state,   $stateParams) {
      function nuRepository() {
        this.params                = {};
        this.idKey                 = 'id';
        this.viewState             = '.view';
        this.updateState           = '.update';
        this.promise               = null;
        this.response              = {};
        this.isListLoading         = false;
        this.isAutoCompleteLoading = false;
        this.isGetLoading          = false;
        this.isUpdateLoading       = false;
        this.isStoreLoading        = false;
        this.isDeleteLoading       = false;
      };

      nuRepository.prototype.init = function () {
        var self = this;
        self.setResource(self.resourceName);
      };

      nuRepository.prototype.setParams = function (params) {
        var self = this;
        self.params = params;
      };
      nuRepository.prototype.addParams = function (params) {
        var self = this;
        angular.merge(self.params, params);
      };

      nuRepository.prototype.setResource = function (resourceName) {
        var self = this;
        self._resource = $injector.get(resourceName);
        self.resourceName = resourceName;
      };

      nuRepository.prototype.getPaginated = function (queryParams, callback) {
        var self = this;
        var params = angular.merge(self.params, queryParams || {});

        self.promise = self.paginate(params);
        self.promise.then(function(response) {
          self.response = response;

          if(callback) callback(response);
        });
        return self.promise;
      };

      nuRepository.prototype.onPaginate = function (page, limit) {
        var self = this;
        angular.merge(self.params, provider.pagingParamGetter(page, limit));

        self.getPaginated();
      };

      nuRepository.prototype.viewPage = function(id){
        var self = this;
        if(!self.viewState) return;
        var viewParams = {};
        viewParams[self.idKey] = id;
        $state.go(self.viewState, viewParams);
      };

      nuRepository.prototype.updatePage = function(id){
        var self = this;
        var updateParams = {};
        $state.go(self.updateState, updateParams);
      };

      nuRepository.prototype.paginate = function (queryParams) {
        var self = this;
        self.isListLoading = true;
        self.promise = self._resource.query(queryParams).$promise;
        self.promise.then(function() {
          self.isListLoading = false;
        });
        return self.promise;
      };

      nuRepository.prototype.autocomplete = function (query, queryParams) {
        var self = this;
        self.isAutoCompleteLoading = true;

        var defer = $q.defer();
        var params = angular.extend({filter:{query:query}}, queryParams);
        self.getPaginated(params);
        self.promise.then(function(response) {
          defer.resolve(response.data);
          self.isAutoCompleteLoading = false;
        });
        return defer.promise;
      };

      nuRepository.prototype.get = function (id, extraParams) {
        var self = this;
        self.isGetLoading = true;
        
        var params = {
          id: id
        };
        angular.extend(params, extraParams);

        self.promise = self._resource.get(params).$promise;
        self.promise.then(function(response) {
          self.response = response;
          self.isGetLoading = false;
        });
        return self.promise;
      };
      nuRepository.prototype.update = function (id, data, extraParams) {
        var self = this;
        self.isUpdateLoading = true;
        var params    = {};
        if(id) params = angular.extend({id: id}, extraParams);
        else params   = extraParams;
        var result    = self._resource.update(params, data).$promise;
        result.then(function(response) {
          self.response = response;
          self.isUpdateLoading = false;
        });

        return result;
      };

      nuRepository.prototype.store = function (data, params) {
        var self = this;
        self.isStoreLoading = true;

        var result = null;
        if(params) result = self._resource.save(params, data).$promise;
        else       result = self._resource.save(data).$promise;
        self.promise = result;
        self.promise.then(function(response) {
          self.response = response;
          self.isStoreLoading = false;
        });
        return result;
      };

      nuRepository.prototype.delete = function (id, extraParams) {
        var self = this;
        self.isDeleteLoading = true;

        var params = angular.extend({id:id}, extraParams);
        self.promise = self._resource.delete(params).$promise;
        self.promise.then(function(response) {
          self.isDeleteLoading = false;
        });

        return self.promise;
      };

      nuRepository.prototype.load = function (params) {
        var self = this;
        return self.getPaginated(params);
      };

      return function(options) {
        options = options || {};

        var Repository = function() {
          var self = this;
          nuRepository.apply(self, arguments);
          angular.extend(self, options);
          self.init();
        };
        Repository.prototype = new nuRepository();

        return Repository;
      }
    }
  ];
};

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

var nuElements = [
  function () {
    return {
      content: null
    };
  }
];

var nuEqualto = function() {
  return {
    require: "ngModel",
    restrict: 'A',
    scope: {
      nuEqualto: "="
    },
    link: function(scope, element, attributes, ngModelCtrl) {

      ngModelCtrl.$validators.nuEqualto = function(value) {
        return value == scope.nuEqualto;
      };

      scope.$watch("nuEqualto", function() {
        ngModelCtrl.$validate();
      });
    }
  };
};

var nuFocuser = ['$timeout', '$parse',
  function (      $timeout,   $parse) {
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

var nuPageTitle = ['$rootScope', '$timeout', function ($rootScope, $timeout) {
  return {
    restrict: 'A',
    scope:{
      pageTitle: '@'
    },
    link: function(scope, element) {
      var listener = function(event, toState, toParams, fromState, fromParams) {
        $rootScope.appName = scope.pageTitle;
        var title = scope.pageTitle;
        var suffix = scope.pageTitle ? ' | ' + title : '';

        if (toState.data && toState.data.pageTitle) title = toState.data.pageTitle + suffix;
        $timeout(function() {
          element.text(title);
        });
      };
      $rootScope.$on('$stateChangeStart', listener);
    }
  }
}];

var nuForm = ['$timeout',
  function($timeout) {
    return {
      restrict: 'E',
      template: "<form name='{{formName}}' novalidate ng-submit='form.$valid && submit($event)'>" +
                  "<ng-transclude ng-transclude-slot='header'></ng-transclude>" +
                  "<div layout-padding>" +
                    "<div layout layout-xs='column' flex layout-wrap>" +
                      "<div " +
                        'flex="{{field[\'flex\'] || 50}}" ' +
                        'flex-xs="{{field[\'flex-xs\'] || 100}}" ' +
                        "ng-repeat='field in config.fields'>" +

                        "<nu-form-field field='field' ng-model='field.model'></nu-form-field>" +
                      "</div>" +
                    "</div>" +
                  "</div>" +
                  "<ng-transclude ng-transclude-slot='footer'></ng-transclude>" +
                "</form>",
      transclude: {
        'header': '?nuFormHeader',
        'footer': '?nuFormFooter'
      },
      scope: {
        onSubmit: '=?',
        config: '=',
        ngModel: '=',
        formName: '@?',
      },
      replace: true,
      compile: function (el, attributes) {

        return function(scope, el, attrs) {
          scope.formName = scope.formName || 'newForm';
          scope.onSubmit = scope.onSubmit || angular.noop;

          $timeout(function() {
            scope.form = scope[scope.formName];
          });

          scope.submit = function ($event) {
            scope.onSubmit($event, scope.ngModel);
          };
        };
      }
    };
  }
];
var nuFormField = ['$parse', '$compile',
  function($parse, $compile) {
    return {
      restrict: 'E',
      template: "<div flex></div>",
      replace: true,
      require: 'ngModel',
      compile: function (element, attributes) {

        return function(scope, el, attrs, ngModelCtrl) {
          var validationAttributes = "";

          if(scope.field.type == 'email'){
            scope.field.validations['ng-pattern'] = "/^.+@.+\..+$/";
            scope.field.validations['ng-maxlength'] = 100;
          }

          var context       = scope.$parent.ngModel;
          var getter        = null;
          if(scope.field.type != 'autocomplete'){
            getter = $parse(scope.field.modelTemplate);
            scope.field.model = getter(context);
          }else{
            scope.field.selectedItem = scope.ngModel.included[scope.ngModel.data.relationships[scope.field.name].data.type][scope.ngModel.data.relationships[scope.field.name].data.id];
            console.log(scope.ngModel.included[scope.ngModel.data.relationships[scope.field.name].data.type]);
          }

          if(scope.field.type == 'number') scope.field.model = parseFloat(scope.field.model);

          angular.forEach(scope.field.validations, function (value, key) {
            if((key == 'required' || key == 'md-require-match') && value === false) return;
            validationAttributes += key + "='?' ".replace('?', value);
            // fieldEl.attr(key, value);
          });


          var fieldElements = {
            text: "<md-input-container class='md-block'>" +
                    "<label>{{field.label}}</label>" +
                    "<input " + validationAttributes + " type='text' name='{{field.name}}' ng-model='field.model'>" +
                    "<div ng-messages='form[field.name].$error' ng-include=\"'nu.Messages'\"></div>" +
                  "</md-input-container>",
            number: "<md-input-container class='md-block'>" +
                          "<label>{{field.label}}</label>" +
                          "<input " + validationAttributes + " type='number' name='{{field.name}}' ng-model='field.model'>" +
                          "<div ng-messages='form[field.name].$error' ng-include=\"'nu.Messages'\"></div>" +
                        "</md-input-container>",
            date: "<md-input-container class='md-block'>" +
                          "<label>{{field.label}}</label>" +
                          "<md-datepicker " + validationAttributes + " name='{{field.name}}' ng-model='field.model'></md-datepicker>" +
                          "<div ng-messages='form[field.name].$error' ng-include=\"'nu.Messages'\"></div>" +
                        "</md-input-container>",
            email: "<md-input-container class='md-block'>" +
                          "<label>{{field.label}}</label>" +
                          "<input " + validationAttributes + " type='email' name='{{field.name}}' ng-model='field.model'>" +
                          "<div ng-messages='form[field.name].$error' ng-include=\"'nu.Messages'\"></div>" +
                        "</md-input-container>",
            select: "<md-input-container class='md-block'>" +
                          "<label>{{field.label}}</label>" +
                          "<md-select " + validationAttributes + " name='{{field.name}}' ng-model='field.model'>" +
                            "<md-option ng-repeat='(value, label) in field.options' ng-value='value'>{{label}}</md-option>" +
                          "</md-select>" +
                          "<div ng-messages='form[field.name].$error' ng-include=\"'nu.Messages'\">" +
                        "</md-input-container>",
            checkbox: "<md-checkbox " + validationAttributes + " ng-model='field.model'>" +
                          "{{ field.label }}" +
                        "</md-checkbox>",
            switch: "<md-switch " + validationAttributes + " ng-model='field.model'>" +
                          "{{ field.label }}" +
                        "</md-switch>",
            autocomplete: "<md-autocomplete " +
                          validationAttributes + " " +
                          "flex " +
                          "md-delay='400'" +
                          "md-cache='false'" +
                          "md-input-name='{{field.name}}'" +
                          "md-selected-item='field.selectedItem'" +
                          // "md-search-text-change='field.searchTextChange(field.searchText, $parent.ngModel)'" +
                          "md-search-text='field.searchText'" +
                          "md-selected-item-change='selectedItemChange(field.selectedItem)'" +
                          "md-items='item in field.repo.autocomplete(field.searchText)'" +
                          "md-item-text='field.render(item)'" +
                          "md-min-length='1'" +
                          "md-floating-label='{{field.label}}'" +
                          "placeholder='{{field.label}}'>" +
                          "<md-item-template>" +
                            "<span md-highlight-text='field.searchText' md-highlight-flags='^i'>{{field.render(item)}}</span>" +
                          "</md-item-template>" +
                          "<div ng-messages='form[field.name].$error' ng-include=\"'nu.Messages'\">" +
                          "<md-not-found>No matches found for '{{field.searchText}}'.</md-not-found>" +
                        "</md-autocomplete>"
          };

          el.append(fieldElements[scope.field.type]);

          scope.$watch('field.model', function (newValue, oldValue) {
            if(newValue === oldValue) return;
            getter.assign(context, scope.field.model);
          });

          scope.selectedItemChange = function(item) {
            var type = null;
            var id = null;

            if(item) {
              type = item.type;
              id = item.id;
            }

            var typeGetter = $parse(scope.field.typeFieldMap);
            var idGetter   = $parse(scope.field.idFieldMap);
            typeGetter.assign(context, type);
            idGetter.assign(context, id);
          };

          $compile(el)(scope);
        };
      }
    };
  }
];

var nuIfCanDirective = [
            'nuIdentity', '$animate', '$compile',
  function ( nuIdentity,   $animate,   $compile) {
    return {
      multiElement: true,
      transclude: 'element',
      priority: 650,
      terminal: true,
      restrict: 'A',
      $$tlb: true,
      link: function ($scope, $element, $attr, ctrl, $transclude) {
        var block, childScope, previousElements;

        var permissions = $attr.nuIfCan.replace(/\s/g, '').split(',');

        if(nuIdentity.hasAnyPermission(permissions)){
          if (!childScope) {
            $transclude(function(clone, newScope) {
              childScope = newScope;
              clone[clone.length++] = $compile.$$createComment('end nuIfCan', $attr.nuIfCan);

              block = {
                clone: clone
              };
              $animate.enter(clone, $element.parent(), $element);
            });
          }
        } else {
          if (previousElements) {
            previousElements.remove();
            previousElements = null;
          }
          if (childScope) {
            childScope.$destroy();
            childScope = null;
          }
          if (block) {
            previousElements = getBlockNodes(block.clone);
            $animate.leave(previousElements).then(function() {
              previousElements = null;
            });
            block = null;
          }
        }
      }
    };
  }
];

var nuIfRoleDirective = [
            'nuIdentity', '$animate', '$compile',
  function ( nuIdentity,   $animate,   $compile) {
    return {
      multiElement: true,
      transclude: 'element',
      priority: 670,
      terminal: true,
      restrict: 'A',
      $$tlb: true,
      link: function ($scope, $element, $attr, ctrl, $transclude) {
        var block, childScope, previousElements;

        var permissions = $attr.nuIfRole.replace(/\s/g, '').split(',');

        if(nuIdentity.hasAnyPermission(permissions)){
          if (!childScope) {
            $transclude(function(clone, newScope) {
              childScope = newScope;
              clone[clone.length++] = $compile.$$createComment('end nuIfRole', $attr.nuIfRole);

              block = {
                clone: clone
              };
              $animate.enter(clone, $element.parent(), $element);
            });
          }
        } else {
          if (previousElements) {
            previousElements.remove();
            previousElements = null;
          }
          if (childScope) {
            childScope.$destroy();
            childScope = null;
          }
          if (block) {
            previousElements = getBlockNodes(block.clone);
            $animate.leave(previousElements).then(function() {
              previousElements = null;
            });
            block = null;
          }
        }
      }
    };
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

var nuShowJApiAttr = [function() {
  return function(input, field, includes) {
    function findRelated(fields, model) {
      var currentField = fields.splice(0, 1)[0];

      if(fields.length === 0){
        if(angular.isDefined(model.attributes) && angular.isDefined(model.attributes[currentField])){
          return model.attributes[currentField];
        }else{
        return includes[model.relationships[currentField].data.type][model.relationships[currentField].data.id];
        }
      }else{
      var found = includes[model.relationships[currentField].data.type][model.relationships[currentField].data.id];
        return findRelated(fields, found);
      }
    }

    try{
      return findRelated(field.split('.'), input);
    }catch(err){
      return null;
    }
  }
}];

var run = ['$templateCache', function($templateCache) {
  $templateCache.put('nu.Messages',
    '<div ng-message="required">Required</div>' +
    '<div ng-message="md-require-match">Required</div>' +
    '<div ng-message="minlength">Too short</div>' +
    '<div ng-message="maxlength">Too long</div>' +
    '<div ng-message="md-minlength">Too short</div>' +
    '<div ng-message="md-maxlength">Too long</div>' +
    '<div ng-message="pattern" ng-if="field.type != \'email\'">Invalid pattern</div>' +
    '<div ng-message="pattern" ng-if="field.type == \'email\'">Invalid email</div>' +
    '<div ng-message="min">Number must be greater than {{field.validations.min}}</div>' +
    '<div ng-message="max">Number must be smaller than {{field.validations.max}}</div>' +
    '<div ng-message="nuEqualto">Does not match the entry</div>' +
    '<div ng-message="mindate">Date is too early!</div>' +
    '<div ng-message="maxdate">Date is too late!</div>' +
    '<div ng-message="valid">Invalid date!</div>' +
    '<div ng-message="as-unique">Already exist</div>'
  );
}];
angular.module('ngUtils', [])
  .run(run)

  .provider('nuIdentity', nuIdentityProvider)
  .provider('nuAuthorization', nuAuthorizationProvider)
  .provider('nuRepository', nuRepositoryProvider)

  .factory('nuJsonApiResponseTransformer', nuJsonApiResponseTransformer)
  .factory('nuElements', nuElements)

  .directive('nuEqualto', nuEqualto)
  .directive('nuFocuser', nuFocuser)
  .directive('nuElement', nuElement)
  .directive('nuPageTitle', nuPageTitle)
  .directive('nuForm', nuForm)
  .directive('nuFormField', nuFormField)
  .directive('nuIfCan', nuIfCanDirective)
  .directive('nuIfRole', nuIfRoleDirective)

  .filter('nuFromNow', nuFromNow)
  .filter('nuCapitalize', nuCapitalize)
  .filter('nuDateToYears', nuDateToYears)
  .filter('nuShowJApiAttr', nuShowJApiAttr);

})();