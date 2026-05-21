<?php

/**
 * Blog Home Template (Posts Page)
 *
 * @package base-theme
 */

use Timber\Timber;

$context = Timber::context();

// Get the posts page and its blocks
$posts_page_id = get_option('page_for_posts');
if ($posts_page_id) {
    $posts_page = Timber::get_post($posts_page_id);
    $context['post'] = $posts_page;
    $context['page_title'] = $posts_page->post_title;
    // Get ACF fields from the posts page if it has post-list block fields
    $context['fields'] = get_field('block', $posts_page_id);
} else {
    $context['page_title'] = 'Blog';
}

// Get global category settings from options page (Image Content CTA)
$context['global_category_settings'] = get_field('block', 'option');

// Get all categories for tabs
$categories = Timber::get_terms([
    'taxonomy' => 'category',
    'hide_empty' => true,
    'exclude' => [1],
]);
$context['categories'] = $categories;

// Query posts
$paged = (get_query_var('paged')) ? get_query_var('paged') : 1;
$args = [
    'post_type' => 'post',
    'posts_per_page' => 8,
    'paged' => $paged,
    'orderby' => 'date',
    'order' => 'DESC',
];

$query = new WP_Query($args);
$posts = Timber::get_posts($query);

// Clean up excerpts
foreach ($posts as $post) {
    if ($post->excerpt) {
        $post->excerpt = preg_replace('/<a[^>]*class="[^"]*read-more[^"]*"[^>]*>.*?<\/a>/i', '', $post->excerpt);
        $post->excerpt = strip_tags($post->excerpt);
    }
}

$context['posts'] = $posts;
$context['pagination'] = Timber::get_pagination(['total' => $query->max_num_pages]);

// Background settings (default to white background)
$context['background_color'] = 1; // 1 = white background
$context['bg_class'] = 'bg-white';
$context['text_class'] = 'text-secondary';

get_header();

// Get background effects setting from the posts page
$enable_bg_effects = false;
$bg_effects_type = null;
$bg_effects_position = 'top';

if ($posts_page_id) {
    $enable_bg_effects = get_field('enable_background_effects', $posts_page_id);
    $bg_effects_type = get_field('background_effects_type', $posts_page_id);
    $bg_effects_position = get_field('background_effects_position', $posts_page_id) ?: 'top';
}
?>

<?php if ($enable_bg_effects && $bg_effects_type): ?>
    <?php 
    $bg_context = Timber::context();
    $bg_context['position'] = $bg_effects_position;
    if ($bg_effects_type === 'dark') {
        Timber::render('partials/background-effects-dark.twig', $bg_context);
    } elseif ($bg_effects_type === 'white') {
        Timber::render('partials/background-effects-white.twig', $bg_context);
    }
    ?>
<?php endif; ?>

<?php
// Render the page blocks if they exist
if ($posts_page_id) {
    echo do_blocks($posts_page->post_content);
} else {
    // Fallback to blog-home template if no posts page is set
    Timber::render('./partials/blog-home.twig', $context);
}

get_footer();
