// index.js used for /index.html
console.log(
`   // ------------------------------------------ //
  //  Author:  derzombiiie (derz@elidragon.com) //
 //  License: GPLv3 (if not noted otherwise)   //
// ------------------------------------------ //`)

// get newest 10 blog articles from api
$.get(`/posts?api&${conf.index_post_sort}&len=10&page=${index}`, json => {
    displayshare()
    if ( json.type != "s" )
        return alert( json.text )
    else {
    	rawelements = json
        elements = []
        for( let i = 0 ; i < json.content.length ; i++ ) {
            let elem = new entry(json.content[i].title, json.content[i].author, json.content[i].desc, json.content[i].href, json.content[i].tags, json.content[i].id, json.content[i].rating)
            elements.push(elem)
            $(".content").append(elem.createelement())
        }
        $(".content").append( pager( json.pages, index ) )
    }
})
