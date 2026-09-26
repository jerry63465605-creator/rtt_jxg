# Play Framework

The play.js file contains the code that displays the game state to the players.

This file has a few callbacks that are invoked by the common "client.js" library
that is included in all the modules and sets up the websocket communication with
the server.

The core framework that client.js requires a certain structure in play.html such as the header
bar, side bar with log, and the menu where it inserts and manages common features like the
chat window, updating the game log, replay buttons, panning and zooming the main board display,
etc.

However, outside of this common structure it makes very few assumptions about how the
game itself is displayed and updated.

## Introducing the World

To reduce the amount of bespoke code that each module needs, there is a common library
that recent modules use to provide a more structured approach to defining and managing
the HTML elements needed to display the game's components.

A copy of this library is included in the template repo in world.css and world.js.

You should include copies of these files in your module, so that your module won't break if these
files are ever updated in non-backwards-compatible ways.

The world code provides a way to define and attach behaviors to the components of the game in a simple manner.

Each "thing" corresponds to an HTML element. Some of the things represent the physical pieces of the game
(such as cards, pawns, chits, and markers). Some of the things can be used to represent areas on the game board that you can interact
with, and yet other things are merely used as containers for other things.

In the on_init callback you must define all the things that represent the game.

In the on_update callback you will call functions to arrange the things to represent
the current game state.

## Other useful globals

The world library defines a global "world" object which has a few other useful properties:

	world.tip -- the larger top-right zoomed in tip element
	world.status -- the bottom-left text tooltip element
	world.header -- the header element

## Initialize the world

In the client on_init callback you should define all the components and behaviors of the game.

	function on_init(scenario, options, static_view) {
		define_board("#map", 1950, 1688)
		// TODO: DEFINE COMPONENTS
	}

## Defining the board

### define_board(selector, width, height, padding)

This function defines a game board and sets the implicit parent for the following "layout" behaviors.

Padding is the safe margin used when laying out stacks on this board, in the usual HTML top/right/bottom/left order.

	define_board("#map", 1650, 1275, [ 12, 12, 12, 12 ])

### sort_board(x_weight, y_weight)

You can use this function to sort all the child elements of the board
so that they overlap in a regular order.

## Defining the things

All the things must be defined and have their behaviors attached.

Every thing is identified by a type tag and an id number (unique for each type).

For a unique thing, set the id to undefined.

	function define_thing(thing_type, thing_id)
	function define_html_thing(selector, thing_type, thing_id)

The define_thing method creates a new HTML element, and define_html_thing finds
an existing element in play.html to associate with the thing.

The thing_type tag is always added to the HTML class attribute.

These functions return a handle to the thing which you can then use to attach various
behaviors to.

For example to define all the cards in a card deck:

	for (var i = 1; i <= 55; ++i) {
		define_thing("card", i)
			.keyword("c" + i)
			.action()
			.tooltip("Card #" + i)
	}

## The behaviors

### .action()

This makes the component clickable and attached to a specific action.

The name of the action is the same as the thing_type, and the thing_id is the
action argument.

When the element can be acted on, the HTML element will have a class "action" added automatically.
Use this to add a highlight in the CSS styling to indicate that the component can be interacted with.

### .button()

WIP: A component that behaves like a push button.

### .stackable()

This allows the component to be part of a stack that splays when clicked.

### .animate(duration)

This behavior animates the component's position (and rotation).
Without it, any position changes will be instantaneous.

### .tooltip(text_or_callback)

Adds a mouse-over tooltip text to the component.

### .static_child(parent)

WIP: Attaches the component to another component permanently.

### .layout(rect)

This adds the thing to the current board and sets its position and size.

Use this to define clickable areas on the board, or to position things used
to contain other things (like the anchor for a stack or group of pieces).

### .stack(rect, dx, dy, major_dx, major_dy, minor_dx, minor_dy, threshold, wrap)

Define a thing that holds other things in a stack that will be expanded when
clicked.

The stack thing is added to the board, just like with the layout behavior.

### .keyword(kw)

This adds to the HTML element's class attribute.

### .style(key, value)

This adds to the HTML element's style attribute.

### .text(s)

Set the textContent of the HTML element. Use this to display unstyled text content.

### .text_html(s)

Set the innerHTML of the HTML element. Use this for styled text content.

## Define premades

There are several premade define functions that define a thing and attach a set of commonly used behaviors:

* define_stack
* define_layout
* define_layout_track_h
* define_layout_track_v
* define_layout_grid
* define_button
* define_html_space
* define_space
* define_piece
* define_marker
* define_card
* define_piece_list
* define_marker_list
* define_card_list

## Updating the world

In the on_update callback you need to arrange all the things to represent the current game state.

There's a host of functions to position the components in relation to each other, and to update
the various states (keywords) and contents of components.

### lookup_thing(thing_type, thing_id)

Lookup a thing for more advanced uses.

### update_favicon(url)

Change the current browser tab icon image.

### populate(parent_type, [parent_id], child_type, [child_id])

Put the child in the parent.

### populate_generic(parent_type, [parent_id], keywords, count=1)

Put a generic component in the parent. Generic components are divs with no attached behaviors at all.

### populate_with_list(parent_type, [parent_id], child_type, child_id_list, fallback_keywords)

Put several children in the parent at once.
The fallback_keywords argument is used to create a generic component for any -1 children.

### update_position(thing_type, thing_id, x, y)

Set an absolute position of the thing within its parent.

### update_size(thing_type, thing_id, width, height)

Set the size of a thing.

### update_rotation(thing_type, thing_id, angle)

Set a thing's rotation (uses CSS transform to rotate the element).

### update_show(thing_type, thing_id, show)

Toggle a things visibility (HTML hidden attribute).

### update_style(thing_type, thing_id, property, value)

WIP: Update a CSS style property.

### update_keyword(thing_type, thing_id, keyword, on=true)

Add a keyword to the thing.

### update_text(thing_type, thing_id, x, y)

Set the unstyled text content of a thing.

### update_text_html(thing_type, thing_id, x, y)

Set the styled text content of a thing.

### Example

	function on_update() {
		begin_update()

		// TODO: UPDATE COMPONENTS

		action_button("undo", "Undo")

		end_update()
	}

## Panels

Panels are a bit like boards in that they hold other elements,
but they also have a title bar and can be shown or hidden dynamically.

	function create_panel(parent_selector, thing_type, thing_id, title_text)
	function define_panel(selector, thing_type, thing_id)

And to update the panel's visibility and header:

	function update_panel_show(thing_type, thing_id, show)
	function update_panel_text(thing_type, thing_id, show)
	function update_panel_text_html(thing_type, thing_id, show)

Use populate to put things in the panel body.

## Overlays

Overlays are like panels but are displayed on top of a board.
These are implemented using the details and summary HTML elements.

Use this to create small battle boards or other displays.

They have a title bar with a button that can be used to toggle the overlay
body to reveal what is underneath if it's covering anything important.

	function create_overlay(parent_selector, thing_type, thing_id)
	function define_overlay(selector, thing_type, thing_id)

The status of an overlay can be detected and used to change behavior or layout:

	function is_overlay_open(thing_type, thing_id)
	function is_overlay_hidden(thing_type, thing_id)

To update the overlay visibility and header:

	function update_overlay_show(thing_type, thing_id, show=true)
	function update_overlay_text(thing_type, thing_id, text)
	function update_overlay_text_html(thing_type, thing_id, text)

The overlay can be positioned. It will be centered on top of the coordinates using
the gravity constants, and be offset so it fits onto the screen within the given margins.

	function update_overlay_position(thing_type, thing_id,
		x, y,
		grav_x=0.5, grav_y=0.5,
		top=12, right=12, bottom=top, left=right
	)

For more control you can get the corresponding HTML details element:

	function lookup_overlay(thing_type, thing_id)

## Windows

Windows or dialogs can display information on top of the game board, and be moved around
and resized by the user. The chat box and notepad are windows.

	function create_window(html_id, title, auto_update, should_resize)
	function lookup_window(html_id)
	function show_window(html_id)
	function hide_window(html_id)
	function toggle_window(html_id)
	function update_window_title(html_id, title)
	function update_window_content(html_id, body)

## Log & Prompt

The client.js framework calls on_prompt and on_log to allow
modules to add formatting to the prompt and log messages.

The world.js library adds some useful helper functions:

	function escape_html(text)

To add typographic niceties (such as turning -- into n-dash etc)

	function escape_typography(text)

To add dice and other icons:

	function escape_dice(text, pattern)
	function escape_icon(text, pattern, icon_list)

To add tooltips that will update the world.tip:

	function escape_tip_class(text, pattern, log_className, tip_classNames, names)
	function escape_tip_class_sub(text, pattern, log_className, tip_className_template, names)
	function escape_tip_light(text, pattern, log_className, thing_type, names)
	function escape_tip_clone(text, pattern, log_className, thing_type, names)

Example:

	function escape_text(text) {
		// TODO: FORMAT ESCAPES
		text = escape_typography(text)
		return text
	}

	function on_prompt(text) {
		return escape_text(text)
	}

	function on_log(text, ix) {
		var p = document.createElement("div")
		p.innerHTML = escape_text(text)
		return p
	}

### Log group boxes

Some games might find it useful to create colored boxes to group related messages.

You must first call update_log_boxes to allow the internal box status tracking
to detect if the log has shrunk (in case of undo, for example).

Then call open_log_box and close_log_box when the log encounters markers that should open and close a box, respectively.

Finally call apply_log_boxes to add the class names of the currently open boxes to the current element.
If there are nested boxes, the class names will be joined with a hyphen (for example "outer-inner").

	function on_log(text, ix) {
		var p = document.createElement("div")

		update_log_boxes(ix)

		if (text.startsWith("{")) {
			text = text.substring(1)
			open_log_box(ix, "curly")
		}
		if (text.startsWith("}")) {
			text = text.substring(1)
			close_log_box(ix, "curly")
		}

		apply_log_boxes(ix, p, "box")

		p.innerHTML = escape_text(text)
		return p
	}

In the stylesheet add a background and some margins to display a box:

	#log .box.curly {
		margin: 0 6px;
		background-color: gainsboro;
	}


## Preferences

User preferences that are stored in the browser's local storage.

These preferences should have checkboxes and radio-buttons defined in play.html somewhere
in the menus with input elements.

The preferences are added to the body element as dataset attributes with the current value,
so they can be targeted by CSS. Checkboxes are set to either "true" or "false".
Whenever the user toggles one of these preferences,
the client will first invoke the onchange callback (if present)
and then run on_update to redraw the game.

Hook them up in on_init:

	function init_preference_checkbox(name, initial, onchange)
	function init_preference_radio(name, initial, onchange)

Use these functions to programmatically change or toggle the values:

	function toggle_preference_checkbox(name, value)
	function set_preference_checkbox(name, value)
	function set_preference_radio(name, value)

Use get_preference to read out the current value.

	function get_preference(name, fallback)

## Library

The basic functions for the set and map datatypes are available as well:

	function set_has(set, item)
	function map_get(map, key, missing)
	function map_for_each(map, f)

And for debugging in the Javascript console, the q function will pretty-print a Javascript object to the console.

	>> q(V)
	{ ... view object ... }
