(function() {
    // Immediately set the theme on the <html> tag to prevent FOUC (Flash of Unstyled Content).
    // This script should be placed in the <head> of the document before any other scripts or styles.
    const savedTheme = localStorage.getItem('gso-theme') || 'light'; // Default to 'light'
    document.documentElement.setAttribute('data-theme', savedTheme);
})();