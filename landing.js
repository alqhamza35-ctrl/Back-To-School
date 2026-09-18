// Back to School — landing page language toggle
I18N.init();
document.getElementById('langToggle').addEventListener('click', function () {
    I18N.setLang(I18N.lang === 'ar' ? 'en' : 'ar');
});
