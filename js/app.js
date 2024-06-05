(function () {
    document.querySelector('#logo>svg').addEventListener('click', function () {
        let menuElement = document.querySelector('#menu');

        if (menuElement.classList.contains('on')) {
            menuElement.classList.remove('on');
        } else {
            menuElement.classList.add('on');
        }
    })

    document.addEventListener('DOMContentLoaded', function () {
        var swiper = new Swiper('.swiper-container', {
            slidesPerView: 1,
            spaceBetween: 30,
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            breakpoints: {
                640: {
                    slidesPerView: 1,
                    spaceBetween: 20,
                },
                768: {
                    slidesPerView: 2,
                    spaceBetween: 30,
                },
                1024: {
                    slidesPerView: 3,
                    spaceBetween: 40,
                },
            },
        });
    });

})();
