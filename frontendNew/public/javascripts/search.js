/**
 * Client-side search filter for entry titles
 */

function performSearch() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();

  const timelineItems = document.querySelectorAll('.timeline-item');

  timelineItems.forEach(item => {
    const title = item.querySelector('h4')?.textContent.toLowerCase() || '';
    item.style.display = (query === '' || title.includes(query)) ? 'block' : 'none';
  });
}

// Trigger filtering on typing or Enter key
document.addEventListener('DOMContentLoaded', function () {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', performSearch);
    searchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault(); // Prevent accidental form submission
      }
    });
  }
});
