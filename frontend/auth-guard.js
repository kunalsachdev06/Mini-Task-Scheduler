// Authentication Guard
// Place this at the top of your main JavaScript file

(function() {
  'use strict';
  
  // Check if on login page
  if (window.location.pathname.includes('auth-login.html')) {
    return; // Don't run auth guard on login page
  }
  
  // Check authentication status
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const userId = localStorage.getItem('userId');
  
  if (!isAuthenticated || !userId) {
    // Not authenticated, redirect to login
    console.log('⚠️ User not authenticated. Redirecting to login...');
    window.location.href = 'auth-login.html';
  } else {
    console.log('✅ User authenticated:', userId);
    
    // Display user info in navbar if it exists
    displayUserInfo();
  }
  
  function displayUserInfo() {
    const userEmail = localStorage.getItem('userEmail');
    const userPhone = localStorage.getItem('userPhone');
    const isGuest = localStorage.getItem('isGuest');
    
    // Create user menu in navigation if not exists
    const nav = document.querySelector('nav') || document.querySelector('.app-header');
    if (nav) {
      const userMenu = document.createElement('div');
      userMenu.className = 'user-menu';
      userMenu.style.cssText = 'margin-left: auto; display: flex; align-items: center; gap: 10px;';
      
      const userInfo = document.createElement('span');
      userInfo.style.cssText = 'color: var(--text); font-weight: 500;';
      userInfo.textContent = isGuest ? '👤 Guest' : (userEmail || userPhone || 'User');
      
      const logoutBtn = document.createElement('button');
      logoutBtn.textContent = '🚪 Logout';
      logoutBtn.style.cssText = 'padding: 0.5rem 1rem; background: var(--danger, #ef4444); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
      logoutBtn.onclick = logout;
      
      userMenu.appendChild(userInfo);
      userMenu.appendChild(logoutBtn);
      nav.appendChild(userMenu);
    }
  }
  
  function logout() {
    if (confirm('Are you sure you want to logout?')) {
      // Clear local storage
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userPhone');
      localStorage.removeItem('isGuest');
      
      // Clear tasks if guest
      if (localStorage.getItem('isGuest')) {
        localStorage.removeItem('tasks');
      }
      
      console.log('✅ User logged out');
      
      // Redirect to login
      window.location.href = 'auth-login.html';
    }
  }
  
  // Make logout function globally available
  window.logout = logout;
})();
