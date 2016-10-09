# ngUtils
A utility library based on AngularJS with commonly used services, directives, filters, etc.

## License
This library is provided free of charge and without restriction under the [MIT License](LICENSE)

## Using Bower
This package is installable through Bower.
```
bower install ngUtils --save
```

## nuRepository usage
```
(function() {
    angular.module('app')
        .factory('Category',
        [            '$resource',
            function ($resource) {
                return $resource('/categories/:id', {id: '@id'}, {});
            }
        ])
        .factory('CategoryRepository',
        [            'nuRepository',
            function (nuRepository) {

                function CategoryRepository() {};

                nuRepository(CategoryRepository, 'Category', {idKey: 'categoryId'});
                
                return CategoryRepository;
            }
        ]);
})();
```