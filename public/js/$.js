export function $(arg) {
    if (typeof arg == 'function') {
      document.addEventListener('DOMContentLoaded', arg)
      return;
    }
  
    let elements;
    if (typeof arg === 'string')
      elements = [...document.querySelectorAll(arg)];
    if (arg instanceof HTMLElement)
      elements = [arg];
  
    let query = new Proxy(elements.map($.ƒ), {
      get(target, property) {
        if(+property == +property)target[property]
        if (property == 'forEach')
          return callback => {
            target.forEach(callback)
            return query;
          }
        return (...args) => {
          target.forEach(q => {
            q[property](...args)
          })
          return query
        }
      }
    })
  
    return query
  }
  $.ƒ = function (element) {
    let query = null;
    let _ = fn => (...args) => fn(...args) || query;
    query = new Proxy(element, {
      get(target, property) {
        console.log(property)
        if (property == 'forEach')return;
        if (property == 'element') {
          return target
        }
        if (property == 'css') {
          return _((property, value) => {
            if (typeof property === 'string')
              target.style[property] = value;
            else if (typeof property === 'object')
              Object.entries(property)
                .forEach(([property, value]) => {
                  target.style[property] = value
                })
          })
        }
        if (property == 'on') {
          return _((event, callback) => {
            target.addEventListener(event, callback)
          })
        }
        if (property == 'html') {
          return _(data => {
            if (!data) return target.innerHTML;
            target.innerHTML = data
          })
        }
        if (property == 'text') {
          return _(data => {
            if (!data) return target.innerText;
            target.innerText = data
          })
        }
        return _(callback => {
          query.on(property, (...args) => {
            callback(query, ...args)
          })
        })
      }
    })
    return query;
  }