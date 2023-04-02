
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.58.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.58.0 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let hr;
    	let t2;
    	let form;
    	let label0;
    	let t4;
    	let input0;
    	let t5;
    	let label1;
    	let t7;
    	let input1;
    	let t8;
    	let label2;
    	let t10;
    	let input2;
    	let t11;
    	let input3;
    	let t12;
    	let h2;
    	let t13_value = (/*HBW*/ ctx[4] >= 0 ? Math.round(/*HBW*/ ctx[4]) : 'x') + "";
    	let t13;
    	let t14;
    	let t15_value = (/*D*/ ctx[1] >= 0 ? /*D*/ ctx[1] : '') + "";
    	let t15;
    	let t16_value = (/*F*/ ctx[0] >= 0 || /*D*/ ctx[1] >= 0 ? '/' : '') + "";
    	let t16;
    	let t17_value = (/*F*/ ctx[0] >= 0 ? /*F*/ ctx[0] : '') + "";
    	let t17;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Brinell Hardness Calculator";
    			t1 = space();
    			hr = element("hr");
    			t2 = space();
    			form = element("form");
    			label0 = element("label");
    			label0.textContent = "Enter F";
    			t4 = space();
    			input0 = element("input");
    			t5 = space();
    			label1 = element("label");
    			label1.textContent = "Enter D";
    			t7 = space();
    			input1 = element("input");
    			t8 = space();
    			label2 = element("label");
    			label2.textContent = "Enter d1 & d2";
    			t10 = space();
    			input2 = element("input");
    			t11 = space();
    			input3 = element("input");
    			t12 = space();
    			h2 = element("h2");
    			t13 = text(t13_value);
    			t14 = text(" HBW ");
    			t15 = text(t15_value);
    			t16 = text(t16_value);
    			t17 = text(t17_value);
    			attr_dev(h1, "class", "svelte-2ssk85");
    			add_location(h1, file, 15, 2, 285);
    			attr_dev(hr, "class", "svelte-2ssk85");
    			add_location(hr, file, 16, 2, 324);
    			attr_dev(label0, "for", "number");
    			attr_dev(label0, "class", "svelte-2ssk85");
    			add_location(label0, file, 18, 4, 342);
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "placeholder", "Force");
    			add_location(input0, file, 19, 4, 382);
    			attr_dev(label1, "for", "number");
    			attr_dev(label1, "class", "svelte-2ssk85");
    			add_location(label1, file, 20, 4, 443);
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "placeholder", "Steel ball diameter");
    			add_location(input1, file, 21, 4, 483);
    			attr_dev(label2, "for", "number");
    			attr_dev(label2, "class", "svelte-2ssk85");
    			add_location(label2, file, 22, 4, 558);
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "placeholder", "Diameter 1");
    			add_location(input2, file, 23, 4, 604);
    			attr_dev(input3, "type", "number");
    			attr_dev(input3, "placeholder", "Diameter 2");
    			add_location(input3, file, 24, 4, 671);
    			attr_dev(h2, "class", "svelte-2ssk85");
    			add_location(h2, file, 25, 4, 738);
    			add_location(form, file, 17, 2, 331);
    			attr_dev(main, "class", "container");
    			add_location(main, file, 14, 0, 258);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, hr);
    			append_dev(main, t2);
    			append_dev(main, form);
    			append_dev(form, label0);
    			append_dev(form, t4);
    			append_dev(form, input0);
    			set_input_value(input0, /*F*/ ctx[0]);
    			append_dev(form, t5);
    			append_dev(form, label1);
    			append_dev(form, t7);
    			append_dev(form, input1);
    			set_input_value(input1, /*D*/ ctx[1]);
    			append_dev(form, t8);
    			append_dev(form, label2);
    			append_dev(form, t10);
    			append_dev(form, input2);
    			set_input_value(input2, /*d1*/ ctx[2]);
    			append_dev(form, t11);
    			append_dev(form, input3);
    			set_input_value(input3, /*d2*/ ctx[3]);
    			append_dev(form, t12);
    			append_dev(form, h2);
    			append_dev(h2, t13);
    			append_dev(h2, t14);
    			append_dev(h2, t15);
    			append_dev(h2, t16);
    			append_dev(h2, t17);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[6]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[7]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[8]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[9])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*F*/ 1 && to_number(input0.value) !== /*F*/ ctx[0]) {
    				set_input_value(input0, /*F*/ ctx[0]);
    			}

    			if (dirty & /*D*/ 2 && to_number(input1.value) !== /*D*/ ctx[1]) {
    				set_input_value(input1, /*D*/ ctx[1]);
    			}

    			if (dirty & /*d1*/ 4 && to_number(input2.value) !== /*d1*/ ctx[2]) {
    				set_input_value(input2, /*d1*/ ctx[2]);
    			}

    			if (dirty & /*d2*/ 8 && to_number(input3.value) !== /*d2*/ ctx[3]) {
    				set_input_value(input3, /*d2*/ ctx[3]);
    			}

    			if (dirty & /*HBW*/ 16 && t13_value !== (t13_value = (/*HBW*/ ctx[4] >= 0 ? Math.round(/*HBW*/ ctx[4]) : 'x') + "")) set_data_dev(t13, t13_value);
    			if (dirty & /*D*/ 2 && t15_value !== (t15_value = (/*D*/ ctx[1] >= 0 ? /*D*/ ctx[1] : '') + "")) set_data_dev(t15, t15_value);
    			if (dirty & /*F, D*/ 3 && t16_value !== (t16_value = (/*F*/ ctx[0] >= 0 || /*D*/ ctx[1] >= 0 ? '/' : '') + "")) set_data_dev(t16, t16_value);
    			if (dirty & /*F*/ 1 && t17_value !== (t17_value = (/*F*/ ctx[0] >= 0 ? /*F*/ ctx[0] : '') + "")) set_data_dev(t17, t17_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let dAv;
    	let HBW;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let F;
    	let D;
    	let d1;
    	let d2;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		F = to_number(this.value);
    		$$invalidate(0, F);
    	}

    	function input1_input_handler() {
    		D = to_number(this.value);
    		$$invalidate(1, D);
    	}

    	function input2_input_handler() {
    		d1 = to_number(this.value);
    		$$invalidate(2, d1);
    	}

    	function input3_input_handler() {
    		d2 = to_number(this.value);
    		$$invalidate(3, d2);
    	}

    	$$self.$capture_state = () => ({ F, D, d1, d2, dAv, HBW });

    	$$self.$inject_state = $$props => {
    		if ('F' in $$props) $$invalidate(0, F = $$props.F);
    		if ('D' in $$props) $$invalidate(1, D = $$props.D);
    		if ('d1' in $$props) $$invalidate(2, d1 = $$props.d1);
    		if ('d2' in $$props) $$invalidate(3, d2 = $$props.d2);
    		if ('dAv' in $$props) $$invalidate(5, dAv = $$props.dAv);
    		if ('HBW' in $$props) $$invalidate(4, HBW = $$props.HBW);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*d1, d2*/ 12) {
    			$$invalidate(5, dAv = (d1 + d2) / 2);
    		}

    		if ($$self.$$.dirty & /*F, D, dAv*/ 35) {
    			$$invalidate(4, HBW = 0.102 * 2 * F / (Math.PI * Math.pow(D, 2) * (1 - Math.sqrt(1 - Math.pow(dAv, 2) / Math.pow(D, 2)))) * 9.81);
    		}
    	};

    	return [
    		F,
    		D,
    		d1,
    		d2,
    		HBW,
    		dAv,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
