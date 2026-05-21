<?php
/**
 * Template for password protected pages
 */

get_header();
?>

<main class="password-protected-page relative min-h-[60vh] flex items-center justify-center py-20">
    <div class="container mx-auto px-4">
        <div class="max-w-lg mx-auto text-center">
            <h1 class="text-4xl md:text-5xl font-bold mb-6 text-white">Protected Content</h1>
            <p class="text-lg text-gray-300 mb-10">This content is password protected. Please enter the password to view.</p>
            
            <div class="password-form-wrapper bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20">
                <?php echo get_the_password_form(); ?>
            </div>
        </div>
    </div>
</main>

<?php
get_footer();
