const toggleButtons = document.querySelectorAll('#theme-toggle');
const html = document.documentElement;
// init
if (localStorage.getItem('theme') === 'dark') {
  html.classList.add('dark');
}
toggleButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme','light');
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme','dark');
    }
  });
});
