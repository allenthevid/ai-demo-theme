<?php

/**
 * The template for displaying all single posts
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/#single-post
 *
 * @package base-theme
 */

get_header();

use Timber\Timber;

// Get related posts from the same category
$related_posts = [];
$post = Timber::get_post();
$categories = $post->terms('category');

if ($categories) {
    $category_ids = array_map(function($cat) {
        return $cat->term_id;
    }, $categories);
    
    $related_posts = Timber::get_posts([
        'post_type' => 'post',
        'posts_per_page' => 4,
        'post__not_in' => [$post->ID],
        'category__in' => $category_ids,
        'orderby' => 'date',
        'order' => 'DESC'
    ]);
}

$context = Timber::context([
    'related_posts' => $related_posts,
    'cta_image' => get_field('cta_image_post', 'option'),
    'cta_heading' => get_field('heading_cta_post', 'option'),
    'cta_description' => get_field('description_cta_post', 'option'),
    'cta' => get_field('cta_post', 'option'),
    'cta_type' => get_field('cta_type_post', 'option'),
    'floating_image' => get_field('floating_image_post', 'option'),
]);

?>

<main>
    <?php Timber::render("./templates/single.twig", $context); ?>
</main>

<?php get_footer(); ?>