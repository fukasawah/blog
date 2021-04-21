function showOverlay(/** @type MouseEvent */ ev){
    console.log(ev);
    const $root = document.createElement("div");
    $root.addEventListener("click", hideOverlay);
    $root.classList.add("overlay");
    const $img = document.createElement("img");
    $img.src = ev.currentTarget.href;
    $root.appendChild($img)
    document.body.appendChild($root);
    ev.preventDefault();
    $root.style.opacity = 0;
    setTimeout(() => $root.style.opacity = 1, 0);
}

function hideOverlay(){
    for(const item of document.querySelectorAll(".overlay")){
        item.remove();
    }
}