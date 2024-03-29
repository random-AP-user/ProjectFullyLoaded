// Get the modal
let modal = document.getElementById("myModal");
let btn = document.getElementById("myBtn");
let span = document.getElementsByClassName("close")[0];
let submit = document.getElementById("submit")

btn.onclick = function() {
  modal.style.display = "block";
}

span.onclick = function() {
 
  modal.style.display = "none";
}

function onload() {
  const slides = document.querySelectorAll(".slide");
  let currentSlide = 0;
  function showSlide(index) {
      slides.forEach((slide, i) => {
          if (i === index) {
              slide.style.opacity = 1;
          } else {
              slide.style.opacity = 0;
          }
      });
  }

  function nextSlide() {
      currentSlide = (currentSlide + 1) % slides.length;
      showSlide(currentSlide);
  }

  // Initial setup
  
  // Auto slide every 4 seconds
  setInterval(nextSlide, 6000);

};

