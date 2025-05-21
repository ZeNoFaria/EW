// Set "All" as active by default
document.querySelector('.tag-list#filter-tags .tag:first-child').classList.add('active');

// Direct filtering function
function filterByTag(tagName) {
    console.log('Filtering by tag:', tagName);
    
    // Get all filter tags
    const filterTags = document.querySelectorAll('.tag-list#filter-tags .tag');
    
    // Remove active class from all tags
    filterTags.forEach(tag => tag.classList.remove('active'));
    
    // Add active class to the clicked tag
    const clickedTag = Array.from(filterTags).find(tag => tag.textContent.trim() === tagName);
    if (clickedTag) {
        clickedTag.classList.add('active');
    }
    
    // Get all timeline items
    const timelineItems = document.querySelectorAll('.timeline-item');
    
    // Show all items if "All" is selected
    if (tagName === 'All') {
        timelineItems.forEach(item => {
            item.style.display = 'block';
        });
        return;
    }
    
    // Loop through all timeline items
    timelineItems.forEach(item => {
        // Get all tags in this timeline item
        const itemTags = item.querySelectorAll('.tag-list .tag');
        let matchFound = false;
        
        // Check if any tag in this item matches the selected filter
        itemTags.forEach(itemTag => {
            if (itemTag.textContent.trim() === tagName) {
                matchFound = true;
            }
        });
        
        // Show or hide based on match
        if (matchFound) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Add search functionality
const searchBox = document.querySelector('.search-box input');
const filterButton = document.querySelector('.search-box button');

filterButton.addEventListener('click', function() {
    filterBySearchText();
});

searchBox.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        filterBySearchText();
    }
});

function filterBySearchText() {
    const searchText = searchBox.value.toLowerCase();
    console.log('Searching for:', searchText);
    
    const timelineItems = document.querySelectorAll('.timeline-item');
    
    timelineItems.forEach(item => {
        const itemTitle = item.querySelector('h4').textContent.toLowerCase();
        const itemContent = item.querySelector('p').textContent.toLowerCase();
        
        if (itemTitle.includes(searchText) || itemContent.includes(searchText)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

console.log('Inline tag filtering initialized');