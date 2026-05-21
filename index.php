<?php

/**
 * The main template file
 *
 * This is the most generic template file in a WordPress theme
 * and one of the two required files for a theme (the other being style.css).
 * It is used to display a page when nothing more specific matches a query.
 * E.g., it puts together the home page when no home.php file exists.
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