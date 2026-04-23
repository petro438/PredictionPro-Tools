<?php
/**
 * Plugin Name: Kalshi Volume Dashboard
 * Description: Embeds the Kalshi market volume dashboard via [kalshi_dashboard] shortcode.
 * Version: 1.0.0
 * Author: PredictionPro
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// ── Enqueue assets only when shortcode is present on the page ──────────────
function kalshi_dashboard_assets() {
    global $post;
    if ( is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'kalshi_dashboard' ) ) {
        wp_enqueue_script(
            'chartjs',
            'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
            [],
            '4.4.1',
            true
        );
        wp_enqueue_style(
            'kalshi-dashboard',
            plugin_dir_url( __FILE__ ) . 'kalshi-dashboard.css',
            [],
            '1.0.0'
        );
        wp_enqueue_script(
            'kalshi-dashboard',
            plugin_dir_url( __FILE__ ) . 'kalshi-dashboard.js',
            [ 'chartjs' ],
            '1.0.0',
            true
        );
        // Pass the proxy URL to JS without hardcoding it in the template
        wp_localize_script( 'kalshi-dashboard', 'KalshiConfig', [
            'proxyUrl' => defined( 'KALSHI_PROXY_URL' ) ? KALSHI_PROXY_URL : '',
            'cacheFile' => plugin_dir_url( __FILE__ ) . 'data/snapshot.json',
            'nonce'    => wp_create_nonce( 'kalshi_dashboard' ),
        ] );
    }
}
add_action( 'wp_enqueue_scripts', 'kalshi_dashboard_assets' );

// ── Shortcode ──────────────────────────────────────────────────────────────
function kalshi_dashboard_shortcode( $atts ) {
    ob_start();
    include plugin_dir_path( __FILE__ ) . 'template.php';
    return ob_get_clean();
}
add_shortcode( 'kalshi_dashboard', 'kalshi_dashboard_shortcode' );
