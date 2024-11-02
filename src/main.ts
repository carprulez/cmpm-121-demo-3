// First, ensure your document is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Create a button element
  const button = document.createElement("button");

  // Set the text of the button
  button.innerText = "Click Me";

  // Add a click event listener to the button
  button.addEventListener("click", () => {
    alert("You clicked the button!");
  });

  // Append the button to the body or a specific container
  document.body.appendChild(button);
});
