/**
 * @param {string} type
 * @param {Object} props
 * @param {(HTMLHeadingElement | string | number)[]s} args
*/
export function dom(type, props, ...args) {
    const childrens = args.length ? [].concat(...args) : null;
    return {
        type,
        props: props || {},
        childrens
    };
}
//#region 
function isEventProp(name) {
    return /^on/.test(name);
}
function extractEventName(name) {
    return name.slice(2).toLowerCase();
}
function setProp(node, name, value) {
    if (name === "className") {
        name = "class";
    }
    if (typeof value === "boolean") {
        value = setBooleanProp(node, name, value);
    } else if (value instanceof Array) {
        value = value.join(' ')
    }
    node.setAttribute(name, value);
}
function setBooleanProp(node, name, value) {
    if (value) {
        node[name] = true;
    } else {
        node[name] = false;
    }
    return node[name]
}
function setAttributes(node, props = {}) {
    if (!props) {
        return;
    }
    Object.keys(props)
        .filter(prop => !isEventProp(prop))
        .forEach(name => setProp(node, name, props[name]));
}
function addEventListeners(node, props = {}) {
    if (!props) {
        return;
    }
    Object.keys(props)
        .filter(isEventProp)
        .forEach(event =>
            node.addEventListener(extractEventName(event), props[event])
        );
}
//#endregion

/**
 * @param {string | number | object} node
 * @return {HTMLElement}
*/
export function createElement(node) {
    if (typeof node === "string" || typeof node === "number") {
        return document.createTextNode(node);
    }
    if (node instanceof HTMLElement) return node

    if (typeof node.type === "function") {
        return createElement(node.type(node.props));
    }

    const element = document.createElement(node.type);

    setAttributes(element, node.props);

    addEventListeners(element, node.props);

    node.childrens &&
        node.childrens
            .map(createElement)
            .forEach(child => element.appendChild(child));

    return element;
}
/**
 * @param {string} type
 * @param {Object} props
 * @param {(HTMLElement | string | number)[]} args
*/
export function createElementDom(type, props, ...args) {
    return createElement(dom(type, props, ...args))
}
createElement.dom = createElementDom