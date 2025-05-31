/**
 * Tag filtering functionality for Digital Diary
 */

// Function to filter timeline items by tag
function filterByTag(tagName) {
  // Get all timeline items
  const timelineItems = document.querySelectorAll('.timeline-item');
  
  // Highlight the selected filter tag
  const filterTags = document.querySelectorAll('#filter-tags .tag');
  filterTags.forEach(tag => {
    if (tag.textContent === tagName) {
      tag.classList.add('active');
    } else {
      tag.classList.remove('active');
    }
  });
  
  // Show/hide timeline items based on tag selection
  timelineItems.forEach(item => {
    if (tagName === 'All') {
      // Show all items if 'All' is selected
      item.style.display = 'block';
    } else {
      // Check if the item has the selected tag
      const itemTags = item.querySelectorAll('.tag-list .tag');
      let hasTag = false;
      
      itemTags.forEach(tag => {
        if (tag.textContent === tagName) {
          hasTag = true;
        }
      });
      
      // Show/hide based on tag match
      item.style.display = hasTag ? 'block' : 'none';
    }
  });
}

// Set 'All' as the default selected filter when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on a page with tag filters
  const filterTags = document.querySelector('#filter-tags');
  
  if (filterTags) {
    // Select the 'All' tag by default
    const allTag = filterTags.querySelector('.tag');
    if (allTag) {
      allTag.classList.add('active');
    }
  }
});