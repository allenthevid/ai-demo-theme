<?php

use Symfony\Component\Cache\Adapter\FilesystemAdapter;
use Symfony\Component\Cache\Adapter\TagAwareAdapter;
use Twig\Extra\Cache\CacheExtension;
use Twig\Extra\Cache\CacheRuntime;
use Twig\RuntimeLoader\RuntimeLoaderInterface;

add_filter('timber/locations', function ($paths) {
    $paths['components'] = [
        get_template_directory() . '/components'
    ];
    $paths['snippets'] = [
        get_template_directory() . '/snippets'
    ];
    $paths['partials'] = [
        get_template_directory() . '/partials'
    ];

    return $paths;
});

// Caching — disabled for development base template
define("_CACHE_KEY", rand());

add_filter("timber/context", function ($context) {
    $context["cache_key"] = _CACHE_KEY;

    return $context;
});

add_filter('timber/twig', function ($twig) {
    $twig->addRuntimeLoader(new class implements RuntimeLoaderInterface {
        public function load($class)
        {
            if (CacheRuntime::class === $class) {
                return new CacheRuntime(new TagAwareAdapter(new FilesystemAdapter('', 0, get_template_directory() . '/twig_cache')));
            }
        }
    });
    $twig->addExtension(new CacheExtension());

    return $twig;
});

add_filter('timber/twig/environment/options', function ($options) {
    $options["cache"] = false;
    $options['auto_reload'] = true;
    return $options;
});

add_filter('timber/cache/mode', function () {
    return Timber\Loader::CACHE_NONE;
});

add_filter('timber/context', function ($context) {
    $context['current_url'] = parse_url(Timber\URLHelper::get_current_url())["path"];

    return $context;
});

/*add_filter( 'timber/twig', function( \Twig\Environment $twig ) {
  $twig->addExtension(new IntlExtension());
});*/
