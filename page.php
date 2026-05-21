<?php

/**
 * The template for displaying all pages
 *
 * This is the template that displays all pages by default.
 * Please note that this is the WordPress construct of pages
 * and that other 'pages' on your WordPress site may use a
 * different template.
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package base-theme
 */

get_header();

// Get background effects setting
$enable_bg_effects = get_field('enable_background_effects');
$bg_effects_type = get_field('background_effects_type');
$bg_effects_position = get_field('background_effects_position') ?: 'top';
?>

<?php if ($enable_bg_effects && $bg_effects_type): ?>
    <?php 
    $context = Timber::context();
    $context['position'] = $bg_effects_position;
    if ($bg_effects_type === 'dark') {
        Timber::render('partials/background-effects-dark.twig', $context);
    } elseif ($bg_effects_type === 'white') {
        Timber::render('partials/background-effects-white.twig', $context);
    }
    ?>
<?php endif; ?>

<main class="relative">
    <?php the_content(); ?>
</main>

<?php get_footer(); ?>
