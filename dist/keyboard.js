!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.keyboardJS=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

var Keyboard = require('./lib/keyboard');
var Locale   = require('./lib/locale');
var KeyCombo = require('./lib/key-combo');

var keyboard = new Keyboard();

keyboard.setLocale('us', require('./locales/us'));

exports          = module.exports = keyboard;
exports.Keyboard = Keyboard;
exports.Locale   = Locale;
exports.KeyCombo = KeyCombo;

},{"./lib/key-combo":2,"./lib/keyboard":3,"./lib/locale":4,"./locales/us":5}],2:[function(require,module,exports){

function KeyCombo(keyComboStr) {
  this.sourceStr = keyComboStr;
  this.subCombos = KeyCombo.parseComboStr(keyComboStr);
  this.keyNames  = this.subCombos.reduce(function(memo, nextSubCombo) {
    return memo.concat(nextSubCombo);
  }, []);
}

// TODO: Add support for key combo sequences
KeyCombo.sequenceDeliminator = '>>';
KeyCombo.comboDeliminator    = '>';
KeyCombo.keyDeliminator      = '+';

KeyCombo.parseComboStr = function(keyComboStr) {
  var subComboStrs = KeyCombo._splitStr(keyComboStr, KeyCombo.comboDeliminator);
  var combo        = [];

  for (var i = 0 ; i < subComboStrs.length; i += 1) {
    combo.push(KeyCombo._splitStr(subComboStrs[i], KeyCombo.keyDeliminator));
  }
  return combo;
};

KeyCombo.prototype.check = function(pressedKeyNames) {
  var startingKeyNameIndex = 0;
  for (var i = 0; i < this.subCombos.length; i += 1) {
    startingKeyNameIndex = this._checkSubCombo(
      this.subCombos[i],
      startingKeyNameIndex,
      pressedKeyNames
    );
    if (startingKeyNameIndex === -1) { return false; }
  }
  return true;
};

KeyCombo.prototype.isEqual = function(otherKeyCombo) {
  if (
    !otherKeyCombo ||
    typeof otherKeyCombo !== 'string' &&
    typeof otherKeyCombo !== 'object'
  ) { return false; }

  if (typeof otherKeyCombo === 'string') {
    otherKeyCombo = new KeyCombo(otherKeyCombo);
  }

  if (this.subCombos.length !== otherKeyCombo.subCombos.length) {
    return false;
  }
  for (var i = 0; i < this.subCombos.length; i += 1) {
    if (this.subCombos[i].length !== otherKeyCombo.subCombos[i].length) {
      return false;
    }
  }

  for (var i = 0; i < this.subCombos.length; i += 1) {
    var subCombo      = this.subCombos[i];
    var otherSubCombo = otherKeyCombo.subCombos[i].slice(0);

    for (var j = 0; j < subCombo.length; j += 1) {
      var keyName = subCombo[j];
      var index   = otherSubCombo.indexOf(keyName);

      if (index > -1) {
        otherSubCombo.splice(index, 1);
      }
    }
    if (otherSubCombo.length !== 0) {
      return false;
    }
  }

  return true;
};

KeyCombo._splitStr = function(str, deliminator) {
  var s  = str;
  var d  = deliminator;
  var c  = '';
  var ca = [];

  for (var ci = 0; ci < s.length; ci += 1) {
    if (ci > 0 && s[ci] === d && s[ci - 1] !== '\\') {
      ca.push(c.trim());
      c = '';
      ci += 1;
    }
    c += s[ci];
  }
  if (c) { ca.push(c.trim()); }

  return ca;
};

KeyCombo.prototype._checkSubCombo = function(subCombo, startingKeyNameIndex, pressedKeyNames) {
  subCombo = subCombo.slice(0);
  pressedKeyNames = pressedKeyNames.slice(startingKeyNameIndex);

  var endIndex = startingKeyNameIndex;
  for (var i = 0; i < subCombo.length; i += 1) {

    var keyName = subCombo[i];
    if (keyName[0] === '\\') {
      var escapedKeyName = keyName.slice(1);
      if (
        escapedKeyName === KeyCombo.comboDeliminator ||
        escapedKeyName === KeyCombo.keyDeliminator
      ) {
        keyName = escapedKeyName;
      }
    }

    var index = pressedKeyNames.indexOf(keyName);
    if (index > -1) {
      subCombo.splice(i, 1);
      i -= 1;
      if (index > endIndex) {
        endIndex = index;
      }
      if (subCombo.length === 0) {
        return endIndex;
      }
    }
  }
  return -1;
};


module.exports = KeyCombo;

},{}],3:[function(require,module,exports){
(function (global){

var Locale = require('./locale');
var KeyCombo = require('./key-combo');


function Keyboard(targetWindow, targetElement, platform, userAgent) {
  this._locale               = null;
  this._currentContext       = null;
  this._contexts             = {};
  this._listeners            = [];
  this._appliedListeners     = [];
  this._locales              = {};
  this._targetElement        = null;
  this._targetWindow         = null;
  this._targetPlatform       = '';
  this._targetUserAgent      = '';
  this._isModernBrowser      = false;
  this._targetKeyDownBinding = null;
  this._targetKeyUpBinding   = null;
  this._targetResetBinding   = null;
  this._paused               = false;
  this._callerHandler        = null;

  this.setContext('global');
  this.watch(targetWindow, targetElement, platform, userAgent);
}

Keyboard.prototype.setLocale = function(localeName, localeBuilder) {
  var locale = null;
  if (typeof localeName === 'string') {

    if (localeBuilder) {
      locale = new Locale(localeName);
      localeBuilder(locale, this._targetPlatform, this._targetUserAgent);
    } else {
      locale = this._locales[localeName] || null;
    }
  } else {
    locale     = localeName;
    localeName = locale._localeName;
  }

  this._locale              = locale;
  this._locales[localeName] = locale;
  if (locale) {
    this._locale.pressedKeys = locale.pressedKeys;
  }
};

Keyboard.prototype.getLocale = function(localName) {
  localName || (localName = this._locale.localeName);
  return this._locales[localName] || null;
};

Keyboard.prototype.bind = function(keyComboStr, pressHandler, releaseHandler, preventRepeatByDefault) {
  if (keyComboStr === null || typeof keyComboStr === 'function') {
    preventRepeatByDefault = releaseHandler;
    releaseHandler         = pressHandler;
    pressHandler           = keyComboStr;
    keyComboStr            = null;
  }

  if (
    keyComboStr &&
    typeof keyComboStr === 'object' &&
    typeof keyComboStr.length === 'number'
  ) {
    for (var i = 0; i < keyComboStr.length; i += 1) {
      this.bind(keyComboStr[i], pressHandler, releaseHandler);
    }
    return;
  }

  this._listeners.push({
    keyCombo               : keyComboStr ? new KeyCombo(keyComboStr) : null,
    pressHandler           : pressHandler           || null,
    releaseHandler         : releaseHandler         || null,
    preventRepeat          : preventRepeatByDefault || false,
    preventRepeatByDefault : preventRepeatByDefault || false
  });
};
Keyboard.prototype.addListener = Keyboard.prototype.bind;
Keyboard.prototype.on          = Keyboard.prototype.bind;

Keyboard.prototype.unbind = function(keyComboStr, pressHandler, releaseHandler) {
  if (keyComboStr === null || typeof keyComboStr === 'function') {
    releaseHandler = pressHandler;
    pressHandler   = keyComboStr;
    keyComboStr = null;
  }

  if (
    keyComboStr &&
    typeof keyComboStr === 'object' &&
    typeof keyComboStr.length === 'number'
  ) {
    for (var i = 0; i < keyComboStr.length; i += 1) {
      this.unbind(keyComboStr[i], pressHandler, releaseHandler);
    }
    return;
  }

  for (var i = 0; i < this._listeners.length; i += 1) {
    var listener = this._listeners[i];

    var comboMatches          = !keyComboStr && !listener.keyCombo ||
                                listener.keyCombo && listener.keyCombo.isEqual(keyComboStr);
    var pressHandlerMatches   = !pressHandler && !releaseHandler ||
                                !pressHandler && !listener.pressHandler ||
                                pressHandler === listener.pressHandler;
    var releaseHandlerMatches = !pressHandler && !releaseHandler ||
                                !releaseHandler && !listener.releaseHandler ||
                                releaseHandler === listener.releaseHandler;

    if (comboMatches && pressHandlerMatches && releaseHandlerMatches) {
      this._listeners.splice(i, 1);
      i -= 1;
    }
  }
};
Keyboard.prototype.removeListener = Keyboard.prototype.unbind;
Keyboard.prototype.off            = Keyboard.prototype.unbind;

Keyboard.prototype.setContext = function(contextName) {
  if(this._locale) { this.releaseAllKeys(); }

  if (!this._contexts[contextName]) {
    this._contexts[contextName] = [];
  }
  this._listeners      = this._contexts[contextName];
  this._currentContext = contextName;
};

Keyboard.prototype.getContext = function() {
  return this._currentContext;
};

Keyboard.prototype.withContext = function(contextName, callback) {
  var previousContextName = this.getContext();
  this.setContext(contextName);

  callback();

  this.setContext(previousContextName);
};

Keyboard.prototype.watch = function(targetWindow, targetElement, targetPlatform, targetUserAgent) {
  var _this = this;

  this.stop();

  if (!targetWindow) {
    if (!global.addEventListener && !global.attachEvent) {
      throw new Error('Cannot find global functions addEventListener or attachEvent.');
    }
    targetWindow = global;
  }

  if (typeof targetWindow.nodeType === 'number') {
    targetUserAgent = targetPlatform;
    targetPlatform  = targetElement;
    targetElement   = targetWindow;
    targetWindow    = global;
  }

  if (!targetWindow.addEventListener && !targetWindow.attachEvent) {
    throw new Error('Cannot find addEventListener or attachEvent methods on targetWindow.');
  }

  this._isModernBrowser = !!targetWindow.addEventListener;

  var userAgent = targetWindow.navigator && targetWindow.navigator.userAgent || '';
  var platform  = targetWindow.navigator && targetWindow.navigator.platform  || '';

  targetElement   && targetElement   !== null || (targetElement   = targetWindow.document);
  targetPlatform  && targetPlatform  !== null || (targetPlatform  = platform);
  targetUserAgent && targetUserAgent !== null || (targetUserAgent = userAgent);

  this._targetKeyDownBinding = function(event) {
    _this.pressKey(event.keyCode, event);
    _this._handleCommandBug(event, platform);
  };
  this._targetKeyUpBinding = function(event) {
    _this.releaseKey(event.keyCode, event);
  };
  this._targetResetBinding = function(event) {
    _this.releaseAllKeys(event)
  };

  this._bindEvent(targetElement, 'keydown', this._targetKeyDownBinding);
  this._bindEvent(targetElement, 'keyup',   this._targetKeyUpBinding);
  this._bindEvent(targetWindow,  'focus',   this._targetResetBinding);
  this._bindEvent(targetWindow,  'blur',    this._targetResetBinding);

  this._targetElement   = targetElement;
  this._targetWindow    = targetWindow;
  this._targetPlatform  = targetPlatform;
  this._targetUserAgent = targetUserAgent;
};

Keyboard.prototype.stop = function() {
  var _this = this;

  if (!this._targetElement || !this._targetWindow) { return; }

  this._unbindEvent(this._targetElement, 'keydown', this._targetKeyDownBinding);
  this._unbindEvent(this._targetElement, 'keyup',   this._targetKeyUpBinding);
  this._unbindEvent(this._targetWindow,  'focus',   this._targetResetBinding);
  this._unbindEvent(this._targetWindow,  'blur',    this._targetResetBinding);

  this._targetWindow  = null;
  this._targetElement = null;
};

Keyboard.prototype.pressKey = function(keyCode, event) {
  if (this._paused) { return; }
  if (!this._locale) { throw new Error('Locale not set'); }

  this._locale.pressKey(keyCode);
  this._applyBindings(event);
};

Keyboard.prototype.releaseKey = function(keyCode, event) {
  if (this._paused) { return; }
  if (!this._locale) { throw new Error('Locale not set'); }

  this._locale.releaseKey(keyCode);
  this._clearBindings(event);
};

Keyboard.prototype.releaseAllKeys = function(event) {
  if (this._paused) { return; }
  if (!this._locale) { throw new Error('Locale not set'); }

  this._locale.pressedKeys.length = 0;
  this._clearBindings(event);
};

Keyboard.prototype.pause = function() {
  if (this._paused) { return; }
  if (this._locale) { this.releaseAllKeys(); }
  this._paused = true;
};

Keyboard.prototype.resume = function() {
  this._paused = false;
};

Keyboard.prototype.reset = function() {
  this.releaseAllKeys();
  this._listeners.length = 0;
};

Keyboard.prototype._bindEvent = function(targetElement, eventName, handler) {
  return this._isModernBrowser ?
    targetElement.addEventListener(eventName, handler, false) :
    targetElement.attachEvent('on' + eventName, handler);
};

Keyboard.prototype._unbindEvent = function(targetElement, eventName, handler) {
  return this._isModernBrowser ?
    targetElement.removeEventListener(eventName, handler, false) :
    targetElement.detachEvent('on' + eventName, handler);
};

Keyboard.prototype._getGroupedListeners = function() {
  var listenerGroups   = [];
  var listenerGroupMap = [];

  var listeners = this._listeners;
  if (this._currentContext !== 'global') {
    listeners = [].concat(listeners, this._contexts.global);
  }

  listeners.sort(function(a, b) {
    return (b.keyCombo ? b.keyCombo.keyNames.length : 0) - (a.keyCombo ? a.keyCombo.keyNames.length : 0);
  }).forEach(function(l) {
    var mapIndex = -1;
    for (var i = 0; i < listenerGroupMap.length; i += 1) {
      if (listenerGroupMap[i] === null && l.keyCombo === null ||
          listenerGroupMap[i] !== null && listenerGroupMap[i].isEqual(l.keyCombo)) {
        mapIndex = i;
      }
    }
    if (mapIndex === -1) {
      mapIndex = listenerGroupMap.length;
      listenerGroupMap.push(l.keyCombo);
    }
    if (!listenerGroups[mapIndex]) {
      listenerGroups[mapIndex] = [];
    }
    listenerGroups[mapIndex].push(l);
  });
  return listenerGroups;
};


var _MAP = {
    8: 'backspace',
    9: 'tab',
    13: 'enter',
    16: 'shift',
    17: 'ctrl',
    18: 'alt',
    20: 'capslock',
    27: 'esc',
    32: 'space',
    33: 'pageup',
    34: 'pagedown',
    35: 'end',
    36: 'home',
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    45: 'ins',
    46: 'del',
    91: 'meta',
    93: 'meta',
    224: 'meta'
};

/**
 * mapping for special characters so they can support
 *
 * this dictionary is only used incase you want to bind a
 * keyup or keydown event to one of these keys
 *
 * @type {Object}
 */
var _KEYCODE_MAP = {
    106: '*',
    107: '+',
    109: '-',
    110: '.',
    111 : '/',
    186: ';',
    187: '=',
    188: ',',
    189: '-',
    190: '.',
    191: '/',
    192: '`',
    219: '[',
    220: '\\',
    221: ']',
    222: '\''
};

   /**
     * takes the event and returns the key character
     *
     * @param {Event} e
     * @return {string}
     */
    function _characterFromEvent(e) {

        // for keypress events we should return the character as is
        if (e.type == 'keypress') {
            var character = String.fromCharCode(e.which);

            // if the shift key is not pressed then it is safe to assume
            // that we want the character to be lowercase.  this means if
            // you accidentally have caps lock on then your key bindings
            // will continue to work
            //
            // the only side effect that might not be desired is if you
            // bind something like 'A' cause you want to trigger an
            // event when capital A is pressed caps lock will no longer
            // trigger the event.  shift+a will though.
            if (!e.shiftKey) {
                character = character.toLowerCase();
            }

            return character;
        }

        // for non keypress events the special maps are needed
        if (_MAP[e.which]) {
            return _MAP[e.which];
        }

        if (_KEYCODE_MAP[e.which]) {
            return _KEYCODE_MAP[e.which];
        }

        // if it is not in the special map

        // with keydown and keyup events the character seems to always
        // come in as an uppercase character whether you are pressing shift
        // or not.  we should make sure it is always lowercase for comparisons
        return String.fromCharCode(e.which).toLowerCase();
    }

Keyboard.prototype._applyBindings = function(event) {
    console.log("_applyBindings", event)
    if (typeof event.which !== 'number') {
        event.which = event.keyCode;
    }

    var character = _characterFromEvent(event);
  var preventRepeat = false;

  event || (event = {});
  event.preventRepeat = function() { preventRepeat = true; };
  event.pressedKeys   = this._locale.pressedKeys.slice(0);

  var pressedKeys    = this._locale.pressedKeys.slice(0);
  var listenerGroups = this._getGroupedListeners();


  for (var i = 0; i < listenerGroups.length; i += 1) {
    var listeners = listenerGroups[i];
    var keyCombo  = listeners[0].keyCombo;

    if (keyCombo === null || keyCombo.check(pressedKeys)) {
      for (var j = 0; j < listeners.length; j += 1) {
        var listener = listeners[j];

        if (keyCombo === null) {
          listener = {
            keyCombo               : new KeyCombo(pressedKeys.join('+')),
            pressHandler           : listener.pressHandler,
            releaseHandler         : listener.releaseHandler,
            preventRepeat          : listener.preventRepeat,
            preventRepeatByDefault : listener.preventRepeatByDefault
          };
        }

        if (listener.pressHandler && !listener.preventRepeat) {
          listener.pressHandler.call(this, event);
          if (preventRepeat) {
            listener.preventRepeat = preventRepeat;
            preventRepeat          = false;
          }
        }

        if (listener.releaseHandler && this._appliedListeners.indexOf(listener) === -1) {
          this._appliedListeners.push(listener);
        }
      }

      if (keyCombo) {
        for (var j = 0; j < keyCombo.keyNames.length; j += 1) {
          var index = pressedKeys.indexOf(keyCombo.keyNames[j]);
          if (index !== -1) {
            pressedKeys.splice(index, 1);
            j -= 1;
          }
        }
      }
    }
  }
};

Keyboard.prototype._clearBindings = function(event) {
  event || (event = {});

  for (var i = 0; i < this._appliedListeners.length; i += 1) {
    var listener = this._appliedListeners[i];
    var keyCombo = listener.keyCombo;
    if (keyCombo === null || !keyCombo.check(this._locale.pressedKeys)) {
      if (this._callerHandler !== listener.releaseHandler) {
        var oldCaller = this._callerHandler;
        this._callerHandler = listener.releaseHandler;
        listener.preventRepeat = listener.preventRepeatByDefault;
        listener.releaseHandler.call(this, event);
        this._callerHandler = oldCaller;
      }
      this._appliedListeners.splice(i, 1);
      i -= 1;
    }
  }
};

Keyboard.prototype._handleCommandBug = function(event, platform) {
  // On Mac when the command key is kept pressed, keyup is not triggered for any other key.
  // In this case force a keyup for non-modifier keys directly after the keypress.
  var modifierKeys = ["shift", "ctrl", "alt", "capslock", "tab", "command"];
  if (platform.match("Mac") && this._locale.pressedKeys.includes("command") &&
      !modifierKeys.includes(this._locale.getKeyNames(event.keyCode)[0])) {
    this._targetKeyUpBinding(event);
  }
};

module.exports = Keyboard;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxpYi9rZXlib2FyZC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIlxudmFyIExvY2FsZSA9IHJlcXVpcmUoJy4vbG9jYWxlJyk7XG52YXIgS2V5Q29tYm8gPSByZXF1aXJlKCcuL2tleS1jb21ibycpO1xuXG5cbmZ1bmN0aW9uIEtleWJvYXJkKHRhcmdldFdpbmRvdywgdGFyZ2V0RWxlbWVudCwgcGxhdGZvcm0sIHVzZXJBZ2VudCkge1xuICB0aGlzLl9sb2NhbGUgICAgICAgICAgICAgICA9IG51bGw7XG4gIHRoaXMuX2N1cnJlbnRDb250ZXh0ICAgICAgID0gbnVsbDtcbiAgdGhpcy5fY29udGV4dHMgICAgICAgICAgICAgPSB7fTtcbiAgdGhpcy5fbGlzdGVuZXJzICAgICAgICAgICAgPSBbXTtcbiAgdGhpcy5fYXBwbGllZExpc3RlbmVycyAgICAgPSBbXTtcbiAgdGhpcy5fbG9jYWxlcyAgICAgICAgICAgICAgPSB7fTtcbiAgdGhpcy5fdGFyZ2V0RWxlbWVudCAgICAgICAgPSBudWxsO1xuICB0aGlzLl90YXJnZXRXaW5kb3cgICAgICAgICA9IG51bGw7XG4gIHRoaXMuX3RhcmdldFBsYXRmb3JtICAgICAgID0gJyc7XG4gIHRoaXMuX3RhcmdldFVzZXJBZ2VudCAgICAgID0gJyc7XG4gIHRoaXMuX2lzTW9kZXJuQnJvd3NlciAgICAgID0gZmFsc2U7XG4gIHRoaXMuX3RhcmdldEtleURvd25CaW5kaW5nID0gbnVsbDtcbiAgdGhpcy5fdGFyZ2V0S2V5VXBCaW5kaW5nICAgPSBudWxsO1xuICB0aGlzLl90YXJnZXRSZXNldEJpbmRpbmcgICA9IG51bGw7XG4gIHRoaXMuX3BhdXNlZCAgICAgICAgICAgICAgID0gZmFsc2U7XG4gIHRoaXMuX2NhbGxlckhhbmRsZXIgICAgICAgID0gbnVsbDtcblxuICB0aGlzLnNldENvbnRleHQoJ2dsb2JhbCcpO1xuICB0aGlzLndhdGNoKHRhcmdldFdpbmRvdywgdGFyZ2V0RWxlbWVudCwgcGxhdGZvcm0sIHVzZXJBZ2VudCk7XG59XG5cbktleWJvYXJkLnByb3RvdHlwZS5zZXRMb2NhbGUgPSBmdW5jdGlvbihsb2NhbGVOYW1lLCBsb2NhbGVCdWlsZGVyKSB7XG4gIHZhciBsb2NhbGUgPSBudWxsO1xuICBpZiAodHlwZW9mIGxvY2FsZU5hbWUgPT09ICdzdHJpbmcnKSB7XG5cbiAgICBpZiAobG9jYWxlQnVpbGRlcikge1xuICAgICAgbG9jYWxlID0gbmV3IExvY2FsZShsb2NhbGVOYW1lKTtcbiAgICAgIGxvY2FsZUJ1aWxkZXIobG9jYWxlLCB0aGlzLl90YXJnZXRQbGF0Zm9ybSwgdGhpcy5fdGFyZ2V0VXNlckFnZW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9jYWxlID0gdGhpcy5fbG9jYWxlc1tsb2NhbGVOYW1lXSB8fCBudWxsO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBsb2NhbGUgICAgID0gbG9jYWxlTmFtZTtcbiAgICBsb2NhbGVOYW1lID0gbG9jYWxlLl9sb2NhbGVOYW1lO1xuICB9XG5cbiAgdGhpcy5fbG9jYWxlICAgICAgICAgICAgICA9IGxvY2FsZTtcbiAgdGhpcy5fbG9jYWxlc1tsb2NhbGVOYW1lXSA9IGxvY2FsZTtcbiAgaWYgKGxvY2FsZSkge1xuICAgIHRoaXMuX2xvY2FsZS5wcmVzc2VkS2V5cyA9IGxvY2FsZS5wcmVzc2VkS2V5cztcbiAgfVxufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLmdldExvY2FsZSA9IGZ1bmN0aW9uKGxvY2FsTmFtZSkge1xuICBsb2NhbE5hbWUgfHwgKGxvY2FsTmFtZSA9IHRoaXMuX2xvY2FsZS5sb2NhbGVOYW1lKTtcbiAgcmV0dXJuIHRoaXMuX2xvY2FsZXNbbG9jYWxOYW1lXSB8fCBudWxsO1xufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbihrZXlDb21ib1N0ciwgcHJlc3NIYW5kbGVyLCByZWxlYXNlSGFuZGxlciwgcHJldmVudFJlcGVhdEJ5RGVmYXVsdCkge1xuICBpZiAoa2V5Q29tYm9TdHIgPT09IG51bGwgfHwgdHlwZW9mIGtleUNvbWJvU3RyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcHJldmVudFJlcGVhdEJ5RGVmYXVsdCA9IHJlbGVhc2VIYW5kbGVyO1xuICAgIHJlbGVhc2VIYW5kbGVyICAgICAgICAgPSBwcmVzc0hhbmRsZXI7XG4gICAgcHJlc3NIYW5kbGVyICAgICAgICAgICA9IGtleUNvbWJvU3RyO1xuICAgIGtleUNvbWJvU3RyICAgICAgICAgICAgPSBudWxsO1xuICB9XG5cbiAgaWYgKFxuICAgIGtleUNvbWJvU3RyICYmXG4gICAgdHlwZW9mIGtleUNvbWJvU3RyID09PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiBrZXlDb21ib1N0ci5sZW5ndGggPT09ICdudW1iZXInXG4gICkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5Q29tYm9TdHIubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgIHRoaXMuYmluZChrZXlDb21ib1N0cltpXSwgcHJlc3NIYW5kbGVyLCByZWxlYXNlSGFuZGxlcik7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMuX2xpc3RlbmVycy5wdXNoKHtcbiAgICBrZXlDb21ibyAgICAgICAgICAgICAgIDoga2V5Q29tYm9TdHIgPyBuZXcgS2V5Q29tYm8oa2V5Q29tYm9TdHIpIDogbnVsbCxcbiAgICBwcmVzc0hhbmRsZXIgICAgICAgICAgIDogcHJlc3NIYW5kbGVyICAgICAgICAgICB8fCBudWxsLFxuICAgIHJlbGVhc2VIYW5kbGVyICAgICAgICAgOiByZWxlYXNlSGFuZGxlciAgICAgICAgIHx8IG51bGwsXG4gICAgcHJldmVudFJlcGVhdCAgICAgICAgICA6IHByZXZlbnRSZXBlYXRCeURlZmF1bHQgfHwgZmFsc2UsXG4gICAgcHJldmVudFJlcGVhdEJ5RGVmYXVsdCA6IHByZXZlbnRSZXBlYXRCeURlZmF1bHQgfHwgZmFsc2VcbiAgfSk7XG59O1xuS2V5Ym9hcmQucHJvdG90eXBlLmFkZExpc3RlbmVyID0gS2V5Ym9hcmQucHJvdG90eXBlLmJpbmQ7XG5LZXlib2FyZC5wcm90b3R5cGUub24gICAgICAgICAgPSBLZXlib2FyZC5wcm90b3R5cGUuYmluZDtcblxuS2V5Ym9hcmQucHJvdG90eXBlLnVuYmluZCA9IGZ1bmN0aW9uKGtleUNvbWJvU3RyLCBwcmVzc0hhbmRsZXIsIHJlbGVhc2VIYW5kbGVyKSB7XG4gIGlmIChrZXlDb21ib1N0ciA9PT0gbnVsbCB8fCB0eXBlb2Yga2V5Q29tYm9TdHIgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZWxlYXNlSGFuZGxlciA9IHByZXNzSGFuZGxlcjtcbiAgICBwcmVzc0hhbmRsZXIgICA9IGtleUNvbWJvU3RyO1xuICAgIGtleUNvbWJvU3RyID0gbnVsbDtcbiAgfVxuXG4gIGlmIChcbiAgICBrZXlDb21ib1N0ciAmJlxuICAgIHR5cGVvZiBrZXlDb21ib1N0ciA9PT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2Yga2V5Q29tYm9TdHIubGVuZ3RoID09PSAnbnVtYmVyJ1xuICApIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleUNvbWJvU3RyLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICB0aGlzLnVuYmluZChrZXlDb21ib1N0cltpXSwgcHJlc3NIYW5kbGVyLCByZWxlYXNlSGFuZGxlcik7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgdmFyIGxpc3RlbmVyID0gdGhpcy5fbGlzdGVuZXJzW2ldO1xuXG4gICAgdmFyIGNvbWJvTWF0Y2hlcyAgICAgICAgICA9ICFrZXlDb21ib1N0ciAmJiAhbGlzdGVuZXIua2V5Q29tYm8gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlzdGVuZXIua2V5Q29tYm8gJiYgbGlzdGVuZXIua2V5Q29tYm8uaXNFcXVhbChrZXlDb21ib1N0cik7XG4gICAgdmFyIHByZXNzSGFuZGxlck1hdGNoZXMgICA9ICFwcmVzc0hhbmRsZXIgJiYgIXJlbGVhc2VIYW5kbGVyIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICFwcmVzc0hhbmRsZXIgJiYgIWxpc3RlbmVyLnByZXNzSGFuZGxlciB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVzc0hhbmRsZXIgPT09IGxpc3RlbmVyLnByZXNzSGFuZGxlcjtcbiAgICB2YXIgcmVsZWFzZUhhbmRsZXJNYXRjaGVzID0gIXByZXNzSGFuZGxlciAmJiAhcmVsZWFzZUhhbmRsZXIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIXJlbGVhc2VIYW5kbGVyICYmICFsaXN0ZW5lci5yZWxlYXNlSGFuZGxlciB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxlYXNlSGFuZGxlciA9PT0gbGlzdGVuZXIucmVsZWFzZUhhbmRsZXI7XG5cbiAgICBpZiAoY29tYm9NYXRjaGVzICYmIHByZXNzSGFuZGxlck1hdGNoZXMgJiYgcmVsZWFzZUhhbmRsZXJNYXRjaGVzKSB7XG4gICAgICB0aGlzLl9saXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgaSAtPSAxO1xuICAgIH1cbiAgfVxufTtcbktleWJvYXJkLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IEtleWJvYXJkLnByb3RvdHlwZS51bmJpbmQ7XG5LZXlib2FyZC5wcm90b3R5cGUub2ZmICAgICAgICAgICAgPSBLZXlib2FyZC5wcm90b3R5cGUudW5iaW5kO1xuXG5LZXlib2FyZC5wcm90b3R5cGUuc2V0Q29udGV4dCA9IGZ1bmN0aW9uKGNvbnRleHROYW1lKSB7XG4gIGlmKHRoaXMuX2xvY2FsZSkgeyB0aGlzLnJlbGVhc2VBbGxLZXlzKCk7IH1cblxuICBpZiAoIXRoaXMuX2NvbnRleHRzW2NvbnRleHROYW1lXSkge1xuICAgIHRoaXMuX2NvbnRleHRzW2NvbnRleHROYW1lXSA9IFtdO1xuICB9XG4gIHRoaXMuX2xpc3RlbmVycyAgICAgID0gdGhpcy5fY29udGV4dHNbY29udGV4dE5hbWVdO1xuICB0aGlzLl9jdXJyZW50Q29udGV4dCA9IGNvbnRleHROYW1lO1xufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLmdldENvbnRleHQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX2N1cnJlbnRDb250ZXh0O1xufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLndpdGhDb250ZXh0ID0gZnVuY3Rpb24oY29udGV4dE5hbWUsIGNhbGxiYWNrKSB7XG4gIHZhciBwcmV2aW91c0NvbnRleHROYW1lID0gdGhpcy5nZXRDb250ZXh0KCk7XG4gIHRoaXMuc2V0Q29udGV4dChjb250ZXh0TmFtZSk7XG5cbiAgY2FsbGJhY2soKTtcblxuICB0aGlzLnNldENvbnRleHQocHJldmlvdXNDb250ZXh0TmFtZSk7XG59O1xuXG5LZXlib2FyZC5wcm90b3R5cGUud2F0Y2ggPSBmdW5jdGlvbih0YXJnZXRXaW5kb3csIHRhcmdldEVsZW1lbnQsIHRhcmdldFBsYXRmb3JtLCB0YXJnZXRVc2VyQWdlbnQpIHtcbiAgdmFyIF90aGlzID0gdGhpcztcblxuICB0aGlzLnN0b3AoKTtcblxuICBpZiAoIXRhcmdldFdpbmRvdykge1xuICAgIGlmICghZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIgJiYgIWdsb2JhbC5hdHRhY2hFdmVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZmluZCBnbG9iYWwgZnVuY3Rpb25zIGFkZEV2ZW50TGlzdGVuZXIgb3IgYXR0YWNoRXZlbnQuJyk7XG4gICAgfVxuICAgIHRhcmdldFdpbmRvdyA9IGdsb2JhbDtcbiAgfVxuXG4gIGlmICh0eXBlb2YgdGFyZ2V0V2luZG93Lm5vZGVUeXBlID09PSAnbnVtYmVyJykge1xuICAgIHRhcmdldFVzZXJBZ2VudCA9IHRhcmdldFBsYXRmb3JtO1xuICAgIHRhcmdldFBsYXRmb3JtICA9IHRhcmdldEVsZW1lbnQ7XG4gICAgdGFyZ2V0RWxlbWVudCAgID0gdGFyZ2V0V2luZG93O1xuICAgIHRhcmdldFdpbmRvdyAgICA9IGdsb2JhbDtcbiAgfVxuXG4gIGlmICghdGFyZ2V0V2luZG93LmFkZEV2ZW50TGlzdGVuZXIgJiYgIXRhcmdldFdpbmRvdy5hdHRhY2hFdmVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZpbmQgYWRkRXZlbnRMaXN0ZW5lciBvciBhdHRhY2hFdmVudCBtZXRob2RzIG9uIHRhcmdldFdpbmRvdy4nKTtcbiAgfVxuXG4gIHRoaXMuX2lzTW9kZXJuQnJvd3NlciA9ICEhdGFyZ2V0V2luZG93LmFkZEV2ZW50TGlzdGVuZXI7XG5cbiAgdmFyIHVzZXJBZ2VudCA9IHRhcmdldFdpbmRvdy5uYXZpZ2F0b3IgJiYgdGFyZ2V0V2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQgfHwgJyc7XG4gIHZhciBwbGF0Zm9ybSAgPSB0YXJnZXRXaW5kb3cubmF2aWdhdG9yICYmIHRhcmdldFdpbmRvdy5uYXZpZ2F0b3IucGxhdGZvcm0gIHx8ICcnO1xuXG4gIHRhcmdldEVsZW1lbnQgICAmJiB0YXJnZXRFbGVtZW50ICAgIT09IG51bGwgfHwgKHRhcmdldEVsZW1lbnQgICA9IHRhcmdldFdpbmRvdy5kb2N1bWVudCk7XG4gIHRhcmdldFBsYXRmb3JtICAmJiB0YXJnZXRQbGF0Zm9ybSAgIT09IG51bGwgfHwgKHRhcmdldFBsYXRmb3JtICA9IHBsYXRmb3JtKTtcbiAgdGFyZ2V0VXNlckFnZW50ICYmIHRhcmdldFVzZXJBZ2VudCAhPT0gbnVsbCB8fCAodGFyZ2V0VXNlckFnZW50ID0gdXNlckFnZW50KTtcblxuICB0aGlzLl90YXJnZXRLZXlEb3duQmluZGluZyA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgX3RoaXMucHJlc3NLZXkoZXZlbnQua2V5Q29kZSwgZXZlbnQpO1xuICAgIF90aGlzLl9oYW5kbGVDb21tYW5kQnVnKGV2ZW50LCBwbGF0Zm9ybSk7XG4gIH07XG4gIHRoaXMuX3RhcmdldEtleVVwQmluZGluZyA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgX3RoaXMucmVsZWFzZUtleShldmVudC5rZXlDb2RlLCBldmVudCk7XG4gIH07XG4gIHRoaXMuX3RhcmdldFJlc2V0QmluZGluZyA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgX3RoaXMucmVsZWFzZUFsbEtleXMoZXZlbnQpXG4gIH07XG5cbiAgdGhpcy5fYmluZEV2ZW50KHRhcmdldEVsZW1lbnQsICdrZXlkb3duJywgdGhpcy5fdGFyZ2V0S2V5RG93bkJpbmRpbmcpO1xuICB0aGlzLl9iaW5kRXZlbnQodGFyZ2V0RWxlbWVudCwgJ2tleXVwJywgICB0aGlzLl90YXJnZXRLZXlVcEJpbmRpbmcpO1xuICB0aGlzLl9iaW5kRXZlbnQodGFyZ2V0V2luZG93LCAgJ2ZvY3VzJywgICB0aGlzLl90YXJnZXRSZXNldEJpbmRpbmcpO1xuICB0aGlzLl9iaW5kRXZlbnQodGFyZ2V0V2luZG93LCAgJ2JsdXInLCAgICB0aGlzLl90YXJnZXRSZXNldEJpbmRpbmcpO1xuXG4gIHRoaXMuX3RhcmdldEVsZW1lbnQgICA9IHRhcmdldEVsZW1lbnQ7XG4gIHRoaXMuX3RhcmdldFdpbmRvdyAgICA9IHRhcmdldFdpbmRvdztcbiAgdGhpcy5fdGFyZ2V0UGxhdGZvcm0gID0gdGFyZ2V0UGxhdGZvcm07XG4gIHRoaXMuX3RhcmdldFVzZXJBZ2VudCA9IHRhcmdldFVzZXJBZ2VudDtcbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgaWYgKCF0aGlzLl90YXJnZXRFbGVtZW50IHx8ICF0aGlzLl90YXJnZXRXaW5kb3cpIHsgcmV0dXJuOyB9XG5cbiAgdGhpcy5fdW5iaW5kRXZlbnQodGhpcy5fdGFyZ2V0RWxlbWVudCwgJ2tleWRvd24nLCB0aGlzLl90YXJnZXRLZXlEb3duQmluZGluZyk7XG4gIHRoaXMuX3VuYmluZEV2ZW50KHRoaXMuX3RhcmdldEVsZW1lbnQsICdrZXl1cCcsICAgdGhpcy5fdGFyZ2V0S2V5VXBCaW5kaW5nKTtcbiAgdGhpcy5fdW5iaW5kRXZlbnQodGhpcy5fdGFyZ2V0V2luZG93LCAgJ2ZvY3VzJywgICB0aGlzLl90YXJnZXRSZXNldEJpbmRpbmcpO1xuICB0aGlzLl91bmJpbmRFdmVudCh0aGlzLl90YXJnZXRXaW5kb3csICAnYmx1cicsICAgIHRoaXMuX3RhcmdldFJlc2V0QmluZGluZyk7XG5cbiAgdGhpcy5fdGFyZ2V0V2luZG93ICA9IG51bGw7XG4gIHRoaXMuX3RhcmdldEVsZW1lbnQgPSBudWxsO1xufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLnByZXNzS2V5ID0gZnVuY3Rpb24oa2V5Q29kZSwgZXZlbnQpIHtcbiAgaWYgKHRoaXMuX3BhdXNlZCkgeyByZXR1cm47IH1cbiAgaWYgKCF0aGlzLl9sb2NhbGUpIHsgdGhyb3cgbmV3IEVycm9yKCdMb2NhbGUgbm90IHNldCcpOyB9XG5cbiAgdGhpcy5fbG9jYWxlLnByZXNzS2V5KGtleUNvZGUpO1xuICB0aGlzLl9hcHBseUJpbmRpbmdzKGV2ZW50KTtcbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS5yZWxlYXNlS2V5ID0gZnVuY3Rpb24oa2V5Q29kZSwgZXZlbnQpIHtcbiAgaWYgKHRoaXMuX3BhdXNlZCkgeyByZXR1cm47IH1cbiAgaWYgKCF0aGlzLl9sb2NhbGUpIHsgdGhyb3cgbmV3IEVycm9yKCdMb2NhbGUgbm90IHNldCcpOyB9XG5cbiAgdGhpcy5fbG9jYWxlLnJlbGVhc2VLZXkoa2V5Q29kZSk7XG4gIHRoaXMuX2NsZWFyQmluZGluZ3MoZXZlbnQpO1xufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLnJlbGVhc2VBbGxLZXlzID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgaWYgKHRoaXMuX3BhdXNlZCkgeyByZXR1cm47IH1cbiAgaWYgKCF0aGlzLl9sb2NhbGUpIHsgdGhyb3cgbmV3IEVycm9yKCdMb2NhbGUgbm90IHNldCcpOyB9XG5cbiAgdGhpcy5fbG9jYWxlLnByZXNzZWRLZXlzLmxlbmd0aCA9IDA7XG4gIHRoaXMuX2NsZWFyQmluZGluZ3MoZXZlbnQpO1xufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLl9wYXVzZWQpIHsgcmV0dXJuOyB9XG4gIGlmICh0aGlzLl9sb2NhbGUpIHsgdGhpcy5yZWxlYXNlQWxsS2V5cygpOyB9XG4gIHRoaXMuX3BhdXNlZCA9IHRydWU7XG59O1xuXG5LZXlib2FyZC5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX3BhdXNlZCA9IGZhbHNlO1xufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMucmVsZWFzZUFsbEtleXMoKTtcbiAgdGhpcy5fbGlzdGVuZXJzLmxlbmd0aCA9IDA7XG59O1xuXG5LZXlib2FyZC5wcm90b3R5cGUuX2JpbmRFdmVudCA9IGZ1bmN0aW9uKHRhcmdldEVsZW1lbnQsIGV2ZW50TmFtZSwgaGFuZGxlcikge1xuICByZXR1cm4gdGhpcy5faXNNb2Rlcm5Ccm93c2VyID9cbiAgICB0YXJnZXRFbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBoYW5kbGVyLCBmYWxzZSkgOlxuICAgIHRhcmdldEVsZW1lbnQuYXR0YWNoRXZlbnQoJ29uJyArIGV2ZW50TmFtZSwgaGFuZGxlcik7XG59O1xuXG5LZXlib2FyZC5wcm90b3R5cGUuX3VuYmluZEV2ZW50ID0gZnVuY3Rpb24odGFyZ2V0RWxlbWVudCwgZXZlbnROYW1lLCBoYW5kbGVyKSB7XG4gIHJldHVybiB0aGlzLl9pc01vZGVybkJyb3dzZXIgP1xuICAgIHRhcmdldEVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGhhbmRsZXIsIGZhbHNlKSA6XG4gICAgdGFyZ2V0RWxlbWVudC5kZXRhY2hFdmVudCgnb24nICsgZXZlbnROYW1lLCBoYW5kbGVyKTtcbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS5fZ2V0R3JvdXBlZExpc3RlbmVycyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgbGlzdGVuZXJHcm91cHMgICA9IFtdO1xuICB2YXIgbGlzdGVuZXJHcm91cE1hcCA9IFtdO1xuXG4gIHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG4gIGlmICh0aGlzLl9jdXJyZW50Q29udGV4dCAhPT0gJ2dsb2JhbCcpIHtcbiAgICBsaXN0ZW5lcnMgPSBbXS5jb25jYXQobGlzdGVuZXJzLCB0aGlzLl9jb250ZXh0cy5nbG9iYWwpO1xuICB9XG5cbiAgbGlzdGVuZXJzLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgIHJldHVybiAoYi5rZXlDb21ibyA/IGIua2V5Q29tYm8ua2V5TmFtZXMubGVuZ3RoIDogMCkgLSAoYS5rZXlDb21ibyA/IGEua2V5Q29tYm8ua2V5TmFtZXMubGVuZ3RoIDogMCk7XG4gIH0pLmZvckVhY2goZnVuY3Rpb24obCkge1xuICAgIHZhciBtYXBJbmRleCA9IC0xO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJHcm91cE1hcC5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgaWYgKGxpc3RlbmVyR3JvdXBNYXBbaV0gPT09IG51bGwgJiYgbC5rZXlDb21ibyA9PT0gbnVsbCB8fFxuICAgICAgICAgIGxpc3RlbmVyR3JvdXBNYXBbaV0gIT09IG51bGwgJiYgbGlzdGVuZXJHcm91cE1hcFtpXS5pc0VxdWFsKGwua2V5Q29tYm8pKSB7XG4gICAgICAgIG1hcEluZGV4ID0gaTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1hcEluZGV4ID09PSAtMSkge1xuICAgICAgbWFwSW5kZXggPSBsaXN0ZW5lckdyb3VwTWFwLmxlbmd0aDtcbiAgICAgIGxpc3RlbmVyR3JvdXBNYXAucHVzaChsLmtleUNvbWJvKTtcbiAgICB9XG4gICAgaWYgKCFsaXN0ZW5lckdyb3Vwc1ttYXBJbmRleF0pIHtcbiAgICAgIGxpc3RlbmVyR3JvdXBzW21hcEluZGV4XSA9IFtdO1xuICAgIH1cbiAgICBsaXN0ZW5lckdyb3Vwc1ttYXBJbmRleF0ucHVzaChsKTtcbiAgfSk7XG4gIHJldHVybiBsaXN0ZW5lckdyb3Vwcztcbn07XG5cblxudmFyIF9NQVAgPSB7XG4gICAgODogJ2JhY2tzcGFjZScsXG4gICAgOTogJ3RhYicsXG4gICAgMTM6ICdlbnRlcicsXG4gICAgMTY6ICdzaGlmdCcsXG4gICAgMTc6ICdjdHJsJyxcbiAgICAxODogJ2FsdCcsXG4gICAgMjA6ICdjYXBzbG9jaycsXG4gICAgMjc6ICdlc2MnLFxuICAgIDMyOiAnc3BhY2UnLFxuICAgIDMzOiAncGFnZXVwJyxcbiAgICAzNDogJ3BhZ2Vkb3duJyxcbiAgICAzNTogJ2VuZCcsXG4gICAgMzY6ICdob21lJyxcbiAgICAzNzogJ2xlZnQnLFxuICAgIDM4OiAndXAnLFxuICAgIDM5OiAncmlnaHQnLFxuICAgIDQwOiAnZG93bicsXG4gICAgNDU6ICdpbnMnLFxuICAgIDQ2OiAnZGVsJyxcbiAgICA5MTogJ21ldGEnLFxuICAgIDkzOiAnbWV0YScsXG4gICAgMjI0OiAnbWV0YSdcbn07XG5cbi8qKlxuICogbWFwcGluZyBmb3Igc3BlY2lhbCBjaGFyYWN0ZXJzIHNvIHRoZXkgY2FuIHN1cHBvcnRcbiAqXG4gKiB0aGlzIGRpY3Rpb25hcnkgaXMgb25seSB1c2VkIGluY2FzZSB5b3Ugd2FudCB0byBiaW5kIGFcbiAqIGtleXVwIG9yIGtleWRvd24gZXZlbnQgdG8gb25lIG9mIHRoZXNlIGtleXNcbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG52YXIgX0tFWUNPREVfTUFQID0ge1xuICAgIDEwNjogJyonLFxuICAgIDEwNzogJysnLFxuICAgIDEwOTogJy0nLFxuICAgIDExMDogJy4nLFxuICAgIDExMSA6ICcvJyxcbiAgICAxODY6ICc7JyxcbiAgICAxODc6ICc9JyxcbiAgICAxODg6ICcsJyxcbiAgICAxODk6ICctJyxcbiAgICAxOTA6ICcuJyxcbiAgICAxOTE6ICcvJyxcbiAgICAxOTI6ICdgJyxcbiAgICAyMTk6ICdbJyxcbiAgICAyMjA6ICdcXFxcJyxcbiAgICAyMjE6ICddJyxcbiAgICAyMjI6ICdcXCcnXG59O1xuXG4gICAvKipcbiAgICAgKiB0YWtlcyB0aGUgZXZlbnQgYW5kIHJldHVybnMgdGhlIGtleSBjaGFyYWN0ZXJcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2NoYXJhY3RlckZyb21FdmVudChlKSB7XG5cbiAgICAgICAgLy8gZm9yIGtleXByZXNzIGV2ZW50cyB3ZSBzaG91bGQgcmV0dXJuIHRoZSBjaGFyYWN0ZXIgYXMgaXNcbiAgICAgICAgaWYgKGUudHlwZSA9PSAna2V5cHJlc3MnKSB7XG4gICAgICAgICAgICB2YXIgY2hhcmFjdGVyID0gU3RyaW5nLmZyb21DaGFyQ29kZShlLndoaWNoKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHNoaWZ0IGtleSBpcyBub3QgcHJlc3NlZCB0aGVuIGl0IGlzIHNhZmUgdG8gYXNzdW1lXG4gICAgICAgICAgICAvLyB0aGF0IHdlIHdhbnQgdGhlIGNoYXJhY3RlciB0byBiZSBsb3dlcmNhc2UuICB0aGlzIG1lYW5zIGlmXG4gICAgICAgICAgICAvLyB5b3UgYWNjaWRlbnRhbGx5IGhhdmUgY2FwcyBsb2NrIG9uIHRoZW4geW91ciBrZXkgYmluZGluZ3NcbiAgICAgICAgICAgIC8vIHdpbGwgY29udGludWUgdG8gd29ya1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIHRoZSBvbmx5IHNpZGUgZWZmZWN0IHRoYXQgbWlnaHQgbm90IGJlIGRlc2lyZWQgaXMgaWYgeW91XG4gICAgICAgICAgICAvLyBiaW5kIHNvbWV0aGluZyBsaWtlICdBJyBjYXVzZSB5b3Ugd2FudCB0byB0cmlnZ2VyIGFuXG4gICAgICAgICAgICAvLyBldmVudCB3aGVuIGNhcGl0YWwgQSBpcyBwcmVzc2VkIGNhcHMgbG9jayB3aWxsIG5vIGxvbmdlclxuICAgICAgICAgICAgLy8gdHJpZ2dlciB0aGUgZXZlbnQuICBzaGlmdCthIHdpbGwgdGhvdWdoLlxuICAgICAgICAgICAgaWYgKCFlLnNoaWZ0S2V5KSB7XG4gICAgICAgICAgICAgICAgY2hhcmFjdGVyID0gY2hhcmFjdGVyLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjaGFyYWN0ZXI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmb3Igbm9uIGtleXByZXNzIGV2ZW50cyB0aGUgc3BlY2lhbCBtYXBzIGFyZSBuZWVkZWRcbiAgICAgICAgaWYgKF9NQVBbZS53aGljaF0pIHtcbiAgICAgICAgICAgIHJldHVybiBfTUFQW2Uud2hpY2hdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF9LRVlDT0RFX01BUFtlLndoaWNoXSkge1xuICAgICAgICAgICAgcmV0dXJuIF9LRVlDT0RFX01BUFtlLndoaWNoXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIGl0IGlzIG5vdCBpbiB0aGUgc3BlY2lhbCBtYXBcblxuICAgICAgICAvLyB3aXRoIGtleWRvd24gYW5kIGtleXVwIGV2ZW50cyB0aGUgY2hhcmFjdGVyIHNlZW1zIHRvIGFsd2F5c1xuICAgICAgICAvLyBjb21lIGluIGFzIGFuIHVwcGVyY2FzZSBjaGFyYWN0ZXIgd2hldGhlciB5b3UgYXJlIHByZXNzaW5nIHNoaWZ0XG4gICAgICAgIC8vIG9yIG5vdC4gIHdlIHNob3VsZCBtYWtlIHN1cmUgaXQgaXMgYWx3YXlzIGxvd2VyY2FzZSBmb3IgY29tcGFyaXNvbnNcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoZS53aGljaCkudG9Mb3dlckNhc2UoKTtcbiAgICB9XG5cbktleWJvYXJkLnByb3RvdHlwZS5fYXBwbHlCaW5kaW5ncyA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgY29uc29sZS5sb2coXCJfYXBwbHlCaW5kaW5nc1wiLCBldmVudClcbiAgICBpZiAodHlwZW9mIGV2ZW50LndoaWNoICE9PSAnbnVtYmVyJykge1xuICAgICAgICBldmVudC53aGljaCA9IGV2ZW50LmtleUNvZGU7XG4gICAgfVxuXG4gICAgdmFyIGNoYXJhY3RlciA9IF9jaGFyYWN0ZXJGcm9tRXZlbnQoZXZlbnQpO1xuICB2YXIgcHJldmVudFJlcGVhdCA9IGZhbHNlO1xuXG4gIGV2ZW50IHx8IChldmVudCA9IHt9KTtcbiAgZXZlbnQucHJldmVudFJlcGVhdCA9IGZ1bmN0aW9uKCkgeyBwcmV2ZW50UmVwZWF0ID0gdHJ1ZTsgfTtcbiAgZXZlbnQucHJlc3NlZEtleXMgICA9IHRoaXMuX2xvY2FsZS5wcmVzc2VkS2V5cy5zbGljZSgwKTtcblxuICB2YXIgcHJlc3NlZEtleXMgICAgPSB0aGlzLl9sb2NhbGUucHJlc3NlZEtleXMuc2xpY2UoMCk7XG4gIHZhciBsaXN0ZW5lckdyb3VwcyA9IHRoaXMuX2dldEdyb3VwZWRMaXN0ZW5lcnMoKTtcblxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJHcm91cHMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICB2YXIgbGlzdGVuZXJzID0gbGlzdGVuZXJHcm91cHNbaV07XG4gICAgdmFyIGtleUNvbWJvICA9IGxpc3RlbmVyc1swXS5rZXlDb21ibztcblxuICAgIGlmIChrZXlDb21ibyA9PT0gbnVsbCB8fCBrZXlDb21iby5jaGVjayhwcmVzc2VkS2V5cykpIHtcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbGlzdGVuZXJzLmxlbmd0aDsgaiArPSAxKSB7XG4gICAgICAgIHZhciBsaXN0ZW5lciA9IGxpc3RlbmVyc1tqXTtcblxuICAgICAgICBpZiAoa2V5Q29tYm8gPT09IG51bGwpIHtcbiAgICAgICAgICBsaXN0ZW5lciA9IHtcbiAgICAgICAgICAgIGtleUNvbWJvICAgICAgICAgICAgICAgOiBuZXcgS2V5Q29tYm8ocHJlc3NlZEtleXMuam9pbignKycpKSxcbiAgICAgICAgICAgIHByZXNzSGFuZGxlciAgICAgICAgICAgOiBsaXN0ZW5lci5wcmVzc0hhbmRsZXIsXG4gICAgICAgICAgICByZWxlYXNlSGFuZGxlciAgICAgICAgIDogbGlzdGVuZXIucmVsZWFzZUhhbmRsZXIsXG4gICAgICAgICAgICBwcmV2ZW50UmVwZWF0ICAgICAgICAgIDogbGlzdGVuZXIucHJldmVudFJlcGVhdCxcbiAgICAgICAgICAgIHByZXZlbnRSZXBlYXRCeURlZmF1bHQgOiBsaXN0ZW5lci5wcmV2ZW50UmVwZWF0QnlEZWZhdWx0XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsaXN0ZW5lci5wcmVzc0hhbmRsZXIgJiYgIWxpc3RlbmVyLnByZXZlbnRSZXBlYXQpIHtcbiAgICAgICAgICBsaXN0ZW5lci5wcmVzc0hhbmRsZXIuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICAgICAgaWYgKHByZXZlbnRSZXBlYXQpIHtcbiAgICAgICAgICAgIGxpc3RlbmVyLnByZXZlbnRSZXBlYXQgPSBwcmV2ZW50UmVwZWF0O1xuICAgICAgICAgICAgcHJldmVudFJlcGVhdCAgICAgICAgICA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsaXN0ZW5lci5yZWxlYXNlSGFuZGxlciAmJiB0aGlzLl9hcHBsaWVkTGlzdGVuZXJzLmluZGV4T2YobGlzdGVuZXIpID09PSAtMSkge1xuICAgICAgICAgIHRoaXMuX2FwcGxpZWRMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGtleUNvbWJvKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwga2V5Q29tYm8ua2V5TmFtZXMubGVuZ3RoOyBqICs9IDEpIHtcbiAgICAgICAgICB2YXIgaW5kZXggPSBwcmVzc2VkS2V5cy5pbmRleE9mKGtleUNvbWJvLmtleU5hbWVzW2pdKTtcbiAgICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICBwcmVzc2VkS2V5cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgaiAtPSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLl9jbGVhckJpbmRpbmdzID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgZXZlbnQgfHwgKGV2ZW50ID0ge30pO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fYXBwbGllZExpc3RlbmVycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIHZhciBsaXN0ZW5lciA9IHRoaXMuX2FwcGxpZWRMaXN0ZW5lcnNbaV07XG4gICAgdmFyIGtleUNvbWJvID0gbGlzdGVuZXIua2V5Q29tYm87XG4gICAgaWYgKGtleUNvbWJvID09PSBudWxsIHx8ICFrZXlDb21iby5jaGVjayh0aGlzLl9sb2NhbGUucHJlc3NlZEtleXMpKSB7XG4gICAgICBpZiAodGhpcy5fY2FsbGVySGFuZGxlciAhPT0gbGlzdGVuZXIucmVsZWFzZUhhbmRsZXIpIHtcbiAgICAgICAgdmFyIG9sZENhbGxlciA9IHRoaXMuX2NhbGxlckhhbmRsZXI7XG4gICAgICAgIHRoaXMuX2NhbGxlckhhbmRsZXIgPSBsaXN0ZW5lci5yZWxlYXNlSGFuZGxlcjtcbiAgICAgICAgbGlzdGVuZXIucHJldmVudFJlcGVhdCA9IGxpc3RlbmVyLnByZXZlbnRSZXBlYXRCeURlZmF1bHQ7XG4gICAgICAgIGxpc3RlbmVyLnJlbGVhc2VIYW5kbGVyLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICB0aGlzLl9jYWxsZXJIYW5kbGVyID0gb2xkQ2FsbGVyO1xuICAgICAgfVxuICAgICAgdGhpcy5fYXBwbGllZExpc3RlbmVycy5zcGxpY2UoaSwgMSk7XG4gICAgICBpIC09IDE7XG4gICAgfVxuICB9XG59O1xuXG5LZXlib2FyZC5wcm90b3R5cGUuX2hhbmRsZUNvbW1hbmRCdWcgPSBmdW5jdGlvbihldmVudCwgcGxhdGZvcm0pIHtcbiAgLy8gT24gTWFjIHdoZW4gdGhlIGNvbW1hbmQga2V5IGlzIGtlcHQgcHJlc3NlZCwga2V5dXAgaXMgbm90IHRyaWdnZXJlZCBmb3IgYW55IG90aGVyIGtleS5cbiAgLy8gSW4gdGhpcyBjYXNlIGZvcmNlIGEga2V5dXAgZm9yIG5vbi1tb2RpZmllciBrZXlzIGRpcmVjdGx5IGFmdGVyIHRoZSBrZXlwcmVzcy5cbiAgdmFyIG1vZGlmaWVyS2V5cyA9IFtcInNoaWZ0XCIsIFwiY3RybFwiLCBcImFsdFwiLCBcImNhcHNsb2NrXCIsIFwidGFiXCIsIFwiY29tbWFuZFwiXTtcbiAgaWYgKHBsYXRmb3JtLm1hdGNoKFwiTWFjXCIpICYmIHRoaXMuX2xvY2FsZS5wcmVzc2VkS2V5cy5pbmNsdWRlcyhcImNvbW1hbmRcIikgJiZcbiAgICAgICFtb2RpZmllcktleXMuaW5jbHVkZXModGhpcy5fbG9jYWxlLmdldEtleU5hbWVzKGV2ZW50LmtleUNvZGUpWzBdKSkge1xuICAgIHRoaXMuX3RhcmdldEtleVVwQmluZGluZyhldmVudCk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gS2V5Ym9hcmQ7XG4iXX0=
},{"./key-combo":2,"./locale":4}],4:[function(require,module,exports){

var KeyCombo = require('./key-combo');


function Locale(name) {
  this.localeName     = name;
  this.pressedKeys    = [];
  this._appliedMacros = [];
  this._keyMap        = {};
  this._killKeyCodes  = [];
  this._macros        = [];
}

Locale.prototype.bindKeyCode = function(keyCode, keyNames) {
  if (typeof keyNames === 'string') {
    keyNames = [keyNames];
  }

  this._keyMap[keyCode] = keyNames;
};

Locale.prototype.bindMacro = function(keyComboStr, keyNames) {
  if (typeof keyNames === 'string') {
    keyNames = [ keyNames ];
  }

  var handler = null;
  if (typeof keyNames === 'function') {
    handler = keyNames;
    keyNames = null;
  }

  var macro = {
    keyCombo : new KeyCombo(keyComboStr),
    keyNames : keyNames,
    handler  : handler
  };

  this._macros.push(macro);
};

Locale.prototype.getKeyCodes = function(keyName) {
  var keyCodes = [];
  for (var keyCode in this._keyMap) {
    var index = this._keyMap[keyCode].indexOf(keyName);
    if (index > -1) { keyCodes.push(keyCode|0); }
  }
  return keyCodes;
};

Locale.prototype.getKeyNames = function(keyCode) {
  return this._keyMap[keyCode] || [];
};

Locale.prototype.setKillKey = function(keyCode) {
  if (typeof keyCode === 'string') {
    var keyCodes = this.getKeyCodes(keyCode);
    for (var i = 0; i < keyCodes.length; i += 1) {
      this.setKillKey(keyCodes[i]);
    }
    return;
  }

  this._killKeyCodes.push(keyCode);
};

Locale.prototype.pressKey = function(keyCode) {
  if (typeof keyCode === 'string') {
    var keyCodes = this.getKeyCodes(keyCode);
    for (var i = 0; i < keyCodes.length; i += 1) {
      this.pressKey(keyCodes[i]);
    }
    return;
  }

  var keyNames = this.getKeyNames(keyCode);
  for (var i = 0; i < keyNames.length; i += 1) {
    if (this.pressedKeys.indexOf(keyNames[i]) === -1) {
      this.pressedKeys.push(keyNames[i]);
    }
  }

  this._applyMacros();
};

Locale.prototype.releaseKey = function(keyCode) {
  if (typeof keyCode === 'string') {
    var keyCodes = this.getKeyCodes(keyCode);
    for (var i = 0; i < keyCodes.length; i += 1) {
      this.releaseKey(keyCodes[i]);
    }
  }

  else {
    var keyNames         = this.getKeyNames(keyCode);
    var killKeyCodeIndex = this._killKeyCodes.indexOf(keyCode);
    
    if (killKeyCodeIndex > -1) {
      this.pressedKeys.length = 0;
    } else {
      for (var i = 0; i < keyNames.length; i += 1) {
        var index = this.pressedKeys.indexOf(keyNames[i]);
        if (index > -1) {
          this.pressedKeys.splice(index, 1);
        }
      }
    }

    this._clearMacros();
  }
};

Locale.prototype._applyMacros = function() {
  var macros = this._macros.slice(0);
  for (var i = 0; i < macros.length; i += 1) {
    var macro = macros[i];
    if (macro.keyCombo.check(this.pressedKeys)) {
      if (macro.handler) {
        macro.keyNames = macro.handler(this.pressedKeys);
      }
      for (var j = 0; j < macro.keyNames.length; j += 1) {
        if (this.pressedKeys.indexOf(macro.keyNames[j]) === -1) {
          this.pressedKeys.push(macro.keyNames[j]);
        }
      }
      this._appliedMacros.push(macro);
    }
  }
};

Locale.prototype._clearMacros = function() {
  for (var i = 0; i < this._appliedMacros.length; i += 1) {
    var macro = this._appliedMacros[i];
    if (!macro.keyCombo.check(this.pressedKeys)) {
      for (var j = 0; j < macro.keyNames.length; j += 1) {
        var index = this.pressedKeys.indexOf(macro.keyNames[j]);
        if (index > -1) {
          this.pressedKeys.splice(index, 1);
        }
      }
      if (macro.handler) {
        macro.keyNames = null;
      }
      this._appliedMacros.splice(i, 1);
      i -= 1;
    }
  }
};


module.exports = Locale;

},{"./key-combo":2}],5:[function(require,module,exports){

module.exports = function(locale, platform, userAgent) {

  // general
  locale.bindKeyCode(3,   ['cancel']);
  locale.bindKeyCode(8,   ['backspace']);
  locale.bindKeyCode(9,   ['tab']);
  locale.bindKeyCode(12,  ['clear']);
  locale.bindKeyCode(13,  ['enter']);
  locale.bindKeyCode(16,  ['shift']);
  locale.bindKeyCode(17,  ['ctrl']);
  locale.bindKeyCode(18,  ['alt', 'menu']);
  locale.bindKeyCode(19,  ['pause', 'break']);
  locale.bindKeyCode(20,  ['capslock']);
  locale.bindKeyCode(27,  ['escape', 'esc']);
  locale.bindKeyCode(32,  ['space', 'spacebar']);
  locale.bindKeyCode(33,  ['pageup']);
  locale.bindKeyCode(34,  ['pagedown']);
  locale.bindKeyCode(35,  ['end']);
  locale.bindKeyCode(36,  ['home']);
  locale.bindKeyCode(37,  ['left']);
  locale.bindKeyCode(38,  ['up']);
  locale.bindKeyCode(39,  ['right']);
  locale.bindKeyCode(40,  ['down']);
  locale.bindKeyCode(41,  ['select']);
  locale.bindKeyCode(42,  ['printscreen']);
  locale.bindKeyCode(43,  ['execute']);
  locale.bindKeyCode(44,  ['snapshot']);
  locale.bindKeyCode(45,  ['insert', 'ins']);
  locale.bindKeyCode(46,  ['delete', 'del']);
  locale.bindKeyCode(47,  ['help']);
  locale.bindKeyCode(145, ['scrolllock', 'scroll']);
  locale.bindKeyCode(188, ['comma', ',']);
  locale.bindKeyCode(190, ['period', '.']);
  locale.bindKeyCode(191, ['slash', 'forwardslash', '/']);
  locale.bindKeyCode(192, ['graveaccent', '`']);
  locale.bindKeyCode(219, ['openbracket', '[']);
  locale.bindKeyCode(220, ['backslash', '\\']);
  locale.bindKeyCode(221, ['closebracket', ']']);
  locale.bindKeyCode(222, ['apostrophe', '\'']);

  // 0-9
  locale.bindKeyCode(48, ['zero', '0']);
  locale.bindKeyCode(49, ['one', '1']);
  locale.bindKeyCode(50, ['two', '2']);
  locale.bindKeyCode(51, ['three', '3']);
  locale.bindKeyCode(52, ['four', '4']);
  locale.bindKeyCode(53, ['five', '5']);
  locale.bindKeyCode(54, ['six', '6']);
  locale.bindKeyCode(55, ['seven', '7']);
  locale.bindKeyCode(56, ['eight', '8']);
  locale.bindKeyCode(57, ['nine', '9']);

  // numpad
  locale.bindKeyCode(96, ['numzero', 'num0']);
  locale.bindKeyCode(97, ['numone', 'num1']);
  locale.bindKeyCode(98, ['numtwo', 'num2']);
  locale.bindKeyCode(99, ['numthree', 'num3']);
  locale.bindKeyCode(100, ['numfour', 'num4']);
  locale.bindKeyCode(101, ['numfive', 'num5']);
  locale.bindKeyCode(102, ['numsix', 'num6']);
  locale.bindKeyCode(103, ['numseven', 'num7']);
  locale.bindKeyCode(104, ['numeight', 'num8']);
  locale.bindKeyCode(105, ['numnine', 'num9']);
  locale.bindKeyCode(106, ['nummultiply', 'num*']);
  locale.bindKeyCode(107, ['numadd', 'num+']);
  locale.bindKeyCode(108, ['numenter']);
  locale.bindKeyCode(109, ['numsubtract', 'num-']);
  locale.bindKeyCode(110, ['numdecimal', 'num.']);
  locale.bindKeyCode(111, ['numdivide', 'num/']);
  locale.bindKeyCode(144, ['numlock', 'num']);

  // function keys
  locale.bindKeyCode(112, ['f1']);
  locale.bindKeyCode(113, ['f2']);
  locale.bindKeyCode(114, ['f3']);
  locale.bindKeyCode(115, ['f4']);
  locale.bindKeyCode(116, ['f5']);
  locale.bindKeyCode(117, ['f6']);
  locale.bindKeyCode(118, ['f7']);
  locale.bindKeyCode(119, ['f8']);
  locale.bindKeyCode(120, ['f9']);
  locale.bindKeyCode(121, ['f10']);
  locale.bindKeyCode(122, ['f11']);
  locale.bindKeyCode(123, ['f12']);
  locale.bindKeyCode(124, ['f13']);
  locale.bindKeyCode(125, ['f14']);
  locale.bindKeyCode(126, ['f15']);
  locale.bindKeyCode(127, ['f16']);
  locale.bindKeyCode(128, ['f17']);
  locale.bindKeyCode(129, ['f18']);
  locale.bindKeyCode(130, ['f19']);
  locale.bindKeyCode(131, ['f20']);
  locale.bindKeyCode(132, ['f21']);
  locale.bindKeyCode(133, ['f22']);
  locale.bindKeyCode(134, ['f23']);
  locale.bindKeyCode(135, ['f24']);

  // secondary key symbols
  locale.bindMacro('shift + `', ['tilde', '~']);
  locale.bindMacro('shift + 1', ['exclamation', 'exclamationpoint', '!']);
  locale.bindMacro('shift + 2', ['at', '@']);
  locale.bindMacro('shift + 3', ['number', '#']);
  locale.bindMacro('shift + 4', ['dollar', 'dollars', 'dollarsign', '$']);
  locale.bindMacro('shift + 5', ['percent', '%']);
  locale.bindMacro('shift + 6', ['caret', '^']);
  locale.bindMacro('shift + 7', ['ampersand', 'and', '&']);
  locale.bindMacro('shift + 8', ['asterisk', '*']);
  locale.bindMacro('shift + 9', ['openparen', '(']);
  locale.bindMacro('shift + 0', ['closeparen', ')']);
  locale.bindMacro('shift + -', ['underscore', '_']);
  locale.bindMacro('shift + =', ['plus', '+']);
  locale.bindMacro('shift + [', ['opencurlybrace', 'opencurlybracket', '{']);
  locale.bindMacro('shift + ]', ['closecurlybrace', 'closecurlybracket', '}']);
  locale.bindMacro('shift + \\', ['verticalbar', '|']);
  locale.bindMacro('shift + ;', ['colon', ':']);
  locale.bindMacro('shift + \'', ['quotationmark', '\'']);
  locale.bindMacro('shift + !,', ['openanglebracket', '<']);
  locale.bindMacro('shift + .', ['closeanglebracket', '>']);
  locale.bindMacro('shift + /', ['questionmark', '?']);
  
  if (platform.match('Mac')) {
    locale.bindMacro('command', ['mod', 'modifier']);
  } else {
    locale.bindMacro('ctrl', ['mod', 'modifier']);
  }

  //a-z and A-Z
  for (var keyCode = 65; keyCode <= 90; keyCode += 1) {
    var keyName = String.fromCharCode(keyCode + 32);
    var capitalKeyName = String.fromCharCode(keyCode);
  	locale.bindKeyCode(keyCode, keyName);
  	locale.bindMacro('shift + ' + keyName, capitalKeyName);
  	locale.bindMacro('capslock + ' + keyName, capitalKeyName);
  }

  // browser caveats
  var semicolonKeyCode = userAgent.match('Firefox') ? 59  : 186;
  var dashKeyCode      = userAgent.match('Firefox') ? 173 : 189;
  var equalKeyCode     = userAgent.match('Firefox') ? 61  : 187;
  var leftCommandKeyCode;
  var rightCommandKeyCode;
  if (platform.match('Mac') && (userAgent.match('Safari') || userAgent.match('Chrome'))) {
    leftCommandKeyCode  = 91;
    rightCommandKeyCode = 93;
  } else if(platform.match('Mac') && userAgent.match('Opera')) {
    leftCommandKeyCode  = 17;
    rightCommandKeyCode = 17;
  } else if(platform.match('Mac') && userAgent.match('Firefox')) {
    leftCommandKeyCode  = 224;
    rightCommandKeyCode = 224;
  }
  locale.bindKeyCode(semicolonKeyCode,    ['semicolon', ';']);
  locale.bindKeyCode(dashKeyCode,         ['dash', '-']);
  locale.bindKeyCode(equalKeyCode,        ['equal', 'equalsign', '=']);
  locale.bindKeyCode(leftCommandKeyCode,  ['command', 'windows', 'win', 'super', 'leftcommand', 'leftwindows', 'leftwin', 'leftsuper']);
  locale.bindKeyCode(rightCommandKeyCode, ['command', 'windows', 'win', 'super', 'rightcommand', 'rightwindows', 'rightwin', 'rightsuper']);

  // kill keys
  locale.setKillKey('command');
};

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsImxpYi9rZXktY29tYm8uanMiLCJsaWIva2V5Ym9hcmQuanMiLCJsaWIvbG9jYWxlLmpzIiwibG9jYWxlcy91cy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6ZUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxudmFyIEtleWJvYXJkID0gcmVxdWlyZSgnLi9saWIva2V5Ym9hcmQnKTtcbnZhciBMb2NhbGUgICA9IHJlcXVpcmUoJy4vbGliL2xvY2FsZScpO1xudmFyIEtleUNvbWJvID0gcmVxdWlyZSgnLi9saWIva2V5LWNvbWJvJyk7XG5cbnZhciBrZXlib2FyZCA9IG5ldyBLZXlib2FyZCgpO1xuXG5rZXlib2FyZC5zZXRMb2NhbGUoJ3VzJywgcmVxdWlyZSgnLi9sb2NhbGVzL3VzJykpO1xuXG5leHBvcnRzICAgICAgICAgID0gbW9kdWxlLmV4cG9ydHMgPSBrZXlib2FyZDtcbmV4cG9ydHMuS2V5Ym9hcmQgPSBLZXlib2FyZDtcbmV4cG9ydHMuTG9jYWxlICAgPSBMb2NhbGU7XG5leHBvcnRzLktleUNvbWJvID0gS2V5Q29tYm87XG4iLCJcbmZ1bmN0aW9uIEtleUNvbWJvKGtleUNvbWJvU3RyKSB7XG4gIHRoaXMuc291cmNlU3RyID0ga2V5Q29tYm9TdHI7XG4gIHRoaXMuc3ViQ29tYm9zID0gS2V5Q29tYm8ucGFyc2VDb21ib1N0cihrZXlDb21ib1N0cik7XG4gIHRoaXMua2V5TmFtZXMgID0gdGhpcy5zdWJDb21ib3MucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIG5leHRTdWJDb21ibykge1xuICAgIHJldHVybiBtZW1vLmNvbmNhdChuZXh0U3ViQ29tYm8pO1xuICB9LCBbXSk7XG59XG5cbi8vIFRPRE86IEFkZCBzdXBwb3J0IGZvciBrZXkgY29tYm8gc2VxdWVuY2VzXG5LZXlDb21iby5zZXF1ZW5jZURlbGltaW5hdG9yID0gJz4+JztcbktleUNvbWJvLmNvbWJvRGVsaW1pbmF0b3IgICAgPSAnPic7XG5LZXlDb21iby5rZXlEZWxpbWluYXRvciAgICAgID0gJysnO1xuXG5LZXlDb21iby5wYXJzZUNvbWJvU3RyID0gZnVuY3Rpb24oa2V5Q29tYm9TdHIpIHtcbiAgdmFyIHN1YkNvbWJvU3RycyA9IEtleUNvbWJvLl9zcGxpdFN0cihrZXlDb21ib1N0ciwgS2V5Q29tYm8uY29tYm9EZWxpbWluYXRvcik7XG4gIHZhciBjb21ibyAgICAgICAgPSBbXTtcblxuICBmb3IgKHZhciBpID0gMCA7IGkgPCBzdWJDb21ib1N0cnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb21iby5wdXNoKEtleUNvbWJvLl9zcGxpdFN0cihzdWJDb21ib1N0cnNbaV0sIEtleUNvbWJvLmtleURlbGltaW5hdG9yKSk7XG4gIH1cbiAgcmV0dXJuIGNvbWJvO1xufTtcblxuS2V5Q29tYm8ucHJvdG90eXBlLmNoZWNrID0gZnVuY3Rpb24ocHJlc3NlZEtleU5hbWVzKSB7XG4gIHZhciBzdGFydGluZ0tleU5hbWVJbmRleCA9IDA7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5zdWJDb21ib3MubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBzdGFydGluZ0tleU5hbWVJbmRleCA9IHRoaXMuX2NoZWNrU3ViQ29tYm8oXG4gICAgICB0aGlzLnN1YkNvbWJvc1tpXSxcbiAgICAgIHN0YXJ0aW5nS2V5TmFtZUluZGV4LFxuICAgICAgcHJlc3NlZEtleU5hbWVzXG4gICAgKTtcbiAgICBpZiAoc3RhcnRpbmdLZXlOYW1lSW5kZXggPT09IC0xKSB7IHJldHVybiBmYWxzZTsgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufTtcblxuS2V5Q29tYm8ucHJvdG90eXBlLmlzRXF1YWwgPSBmdW5jdGlvbihvdGhlcktleUNvbWJvKSB7XG4gIGlmIChcbiAgICAhb3RoZXJLZXlDb21ibyB8fFxuICAgIHR5cGVvZiBvdGhlcktleUNvbWJvICE9PSAnc3RyaW5nJyAmJlxuICAgIHR5cGVvZiBvdGhlcktleUNvbWJvICE9PSAnb2JqZWN0J1xuICApIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgaWYgKHR5cGVvZiBvdGhlcktleUNvbWJvID09PSAnc3RyaW5nJykge1xuICAgIG90aGVyS2V5Q29tYm8gPSBuZXcgS2V5Q29tYm8ob3RoZXJLZXlDb21ibyk7XG4gIH1cblxuICBpZiAodGhpcy5zdWJDb21ib3MubGVuZ3RoICE9PSBvdGhlcktleUNvbWJvLnN1YkNvbWJvcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnN1YkNvbWJvcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGlmICh0aGlzLnN1YkNvbWJvc1tpXS5sZW5ndGggIT09IG90aGVyS2V5Q29tYm8uc3ViQ29tYm9zW2ldLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5zdWJDb21ib3MubGVuZ3RoOyBpICs9IDEpIHtcbiAgICB2YXIgc3ViQ29tYm8gICAgICA9IHRoaXMuc3ViQ29tYm9zW2ldO1xuICAgIHZhciBvdGhlclN1YkNvbWJvID0gb3RoZXJLZXlDb21iby5zdWJDb21ib3NbaV0uc2xpY2UoMCk7XG5cbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IHN1YkNvbWJvLmxlbmd0aDsgaiArPSAxKSB7XG4gICAgICB2YXIga2V5TmFtZSA9IHN1YkNvbWJvW2pdO1xuICAgICAgdmFyIGluZGV4ICAgPSBvdGhlclN1YkNvbWJvLmluZGV4T2Yoa2V5TmFtZSk7XG5cbiAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgIG90aGVyU3ViQ29tYm8uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG90aGVyU3ViQ29tYm8ubGVuZ3RoICE9PSAwKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5LZXlDb21iby5fc3BsaXRTdHIgPSBmdW5jdGlvbihzdHIsIGRlbGltaW5hdG9yKSB7XG4gIHZhciBzICA9IHN0cjtcbiAgdmFyIGQgID0gZGVsaW1pbmF0b3I7XG4gIHZhciBjICA9ICcnO1xuICB2YXIgY2EgPSBbXTtcblxuICBmb3IgKHZhciBjaSA9IDA7IGNpIDwgcy5sZW5ndGg7IGNpICs9IDEpIHtcbiAgICBpZiAoY2kgPiAwICYmIHNbY2ldID09PSBkICYmIHNbY2kgLSAxXSAhPT0gJ1xcXFwnKSB7XG4gICAgICBjYS5wdXNoKGMudHJpbSgpKTtcbiAgICAgIGMgPSAnJztcbiAgICAgIGNpICs9IDE7XG4gICAgfVxuICAgIGMgKz0gc1tjaV07XG4gIH1cbiAgaWYgKGMpIHsgY2EucHVzaChjLnRyaW0oKSk7IH1cblxuICByZXR1cm4gY2E7XG59O1xuXG5LZXlDb21iby5wcm90b3R5cGUuX2NoZWNrU3ViQ29tYm8gPSBmdW5jdGlvbihzdWJDb21ibywgc3RhcnRpbmdLZXlOYW1lSW5kZXgsIHByZXNzZWRLZXlOYW1lcykge1xuICBzdWJDb21ibyA9IHN1YkNvbWJvLnNsaWNlKDApO1xuICBwcmVzc2VkS2V5TmFtZXMgPSBwcmVzc2VkS2V5TmFtZXMuc2xpY2Uoc3RhcnRpbmdLZXlOYW1lSW5kZXgpO1xuXG4gIHZhciBlbmRJbmRleCA9IHN0YXJ0aW5nS2V5TmFtZUluZGV4O1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YkNvbWJvLmxlbmd0aDsgaSArPSAxKSB7XG5cbiAgICB2YXIga2V5TmFtZSA9IHN1YkNvbWJvW2ldO1xuICAgIGlmIChrZXlOYW1lWzBdID09PSAnXFxcXCcpIHtcbiAgICAgIHZhciBlc2NhcGVkS2V5TmFtZSA9IGtleU5hbWUuc2xpY2UoMSk7XG4gICAgICBpZiAoXG4gICAgICAgIGVzY2FwZWRLZXlOYW1lID09PSBLZXlDb21iby5jb21ib0RlbGltaW5hdG9yIHx8XG4gICAgICAgIGVzY2FwZWRLZXlOYW1lID09PSBLZXlDb21iby5rZXlEZWxpbWluYXRvclxuICAgICAgKSB7XG4gICAgICAgIGtleU5hbWUgPSBlc2NhcGVkS2V5TmFtZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgaW5kZXggPSBwcmVzc2VkS2V5TmFtZXMuaW5kZXhPZihrZXlOYW1lKTtcbiAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgc3ViQ29tYm8uc3BsaWNlKGksIDEpO1xuICAgICAgaSAtPSAxO1xuICAgICAgaWYgKGluZGV4ID4gZW5kSW5kZXgpIHtcbiAgICAgICAgZW5kSW5kZXggPSBpbmRleDtcbiAgICAgIH1cbiAgICAgIGlmIChzdWJDb21iby5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGVuZEluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gLTE7XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gS2V5Q29tYm87XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5cbnZhciBMb2NhbGUgPSByZXF1aXJlKCcuL2xvY2FsZScpO1xudmFyIEtleUNvbWJvID0gcmVxdWlyZSgnLi9rZXktY29tYm8nKTtcblxuXG5mdW5jdGlvbiBLZXlib2FyZCh0YXJnZXRXaW5kb3csIHRhcmdldEVsZW1lbnQsIHBsYXRmb3JtLCB1c2VyQWdlbnQpIHtcbiAgdGhpcy5fbG9jYWxlICAgICAgICAgICAgICAgPSBudWxsO1xuICB0aGlzLl9jdXJyZW50Q29udGV4dCAgICAgICA9IG51bGw7XG4gIHRoaXMuX2NvbnRleHRzICAgICAgICAgICAgID0ge307XG4gIHRoaXMuX2xpc3RlbmVycyAgICAgICAgICAgID0gW107XG4gIHRoaXMuX2FwcGxpZWRMaXN0ZW5lcnMgICAgID0gW107XG4gIHRoaXMuX2xvY2FsZXMgICAgICAgICAgICAgID0ge307XG4gIHRoaXMuX3RhcmdldEVsZW1lbnQgICAgICAgID0gbnVsbDtcbiAgdGhpcy5fdGFyZ2V0V2luZG93ICAgICAgICAgPSBudWxsO1xuICB0aGlzLl90YXJnZXRQbGF0Zm9ybSAgICAgICA9ICcnO1xuICB0aGlzLl90YXJnZXRVc2VyQWdlbnQgICAgICA9ICcnO1xuICB0aGlzLl9pc01vZGVybkJyb3dzZXIgICAgICA9IGZhbHNlO1xuICB0aGlzLl90YXJnZXRLZXlEb3duQmluZGluZyA9IG51bGw7XG4gIHRoaXMuX3RhcmdldEtleVVwQmluZGluZyAgID0gbnVsbDtcbiAgdGhpcy5fdGFyZ2V0UmVzZXRCaW5kaW5nICAgPSBudWxsO1xuICB0aGlzLl9wYXVzZWQgICAgICAgICAgICAgICA9IGZhbHNlO1xuICB0aGlzLl9jYWxsZXJIYW5kbGVyICAgICAgICA9IG51bGw7XG5cbiAgdGhpcy5zZXRDb250ZXh0KCdnbG9iYWwnKTtcbiAgdGhpcy53YXRjaCh0YXJnZXRXaW5kb3csIHRhcmdldEVsZW1lbnQsIHBsYXRmb3JtLCB1c2VyQWdlbnQpO1xufVxuXG5LZXlib2FyZC5wcm90b3R5cGUuc2V0TG9jYWxlID0gZnVuY3Rpb24obG9jYWxlTmFtZSwgbG9jYWxlQnVpbGRlcikge1xuICB2YXIgbG9jYWxlID0gbnVsbDtcbiAgaWYgKHR5cGVvZiBsb2NhbGVOYW1lID09PSAnc3RyaW5nJykge1xuXG4gICAgaWYgKGxvY2FsZUJ1aWxkZXIpIHtcbiAgICAgIGxvY2FsZSA9IG5ldyBMb2NhbGUobG9jYWxlTmFtZSk7XG4gICAgICBsb2NhbGVCdWlsZGVyKGxvY2FsZSwgdGhpcy5fdGFyZ2V0UGxhdGZvcm0sIHRoaXMuX3RhcmdldFVzZXJBZ2VudCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvY2FsZSA9IHRoaXMuX2xvY2FsZXNbbG9jYWxlTmFtZV0gfHwgbnVsbDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgbG9jYWxlICAgICA9IGxvY2FsZU5hbWU7XG4gICAgbG9jYWxlTmFtZSA9IGxvY2FsZS5fbG9jYWxlTmFtZTtcbiAgfVxuXG4gIHRoaXMuX2xvY2FsZSAgICAgICAgICAgICAgPSBsb2NhbGU7XG4gIHRoaXMuX2xvY2FsZXNbbG9jYWxlTmFtZV0gPSBsb2NhbGU7XG4gIGlmIChsb2NhbGUpIHtcbiAgICB0aGlzLl9sb2NhbGUucHJlc3NlZEtleXMgPSBsb2NhbGUucHJlc3NlZEtleXM7XG4gIH1cbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS5nZXRMb2NhbGUgPSBmdW5jdGlvbihsb2NhbE5hbWUpIHtcbiAgbG9jYWxOYW1lIHx8IChsb2NhbE5hbWUgPSB0aGlzLl9sb2NhbGUubG9jYWxlTmFtZSk7XG4gIHJldHVybiB0aGlzLl9sb2NhbGVzW2xvY2FsTmFtZV0gfHwgbnVsbDtcbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24oa2V5Q29tYm9TdHIsIHByZXNzSGFuZGxlciwgcmVsZWFzZUhhbmRsZXIsIHByZXZlbnRSZXBlYXRCeURlZmF1bHQpIHtcbiAgaWYgKGtleUNvbWJvU3RyID09PSBudWxsIHx8IHR5cGVvZiBrZXlDb21ib1N0ciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHByZXZlbnRSZXBlYXRCeURlZmF1bHQgPSByZWxlYXNlSGFuZGxlcjtcbiAgICByZWxlYXNlSGFuZGxlciAgICAgICAgID0gcHJlc3NIYW5kbGVyO1xuICAgIHByZXNzSGFuZGxlciAgICAgICAgICAgPSBrZXlDb21ib1N0cjtcbiAgICBrZXlDb21ib1N0ciAgICAgICAgICAgID0gbnVsbDtcbiAgfVxuXG4gIGlmIChcbiAgICBrZXlDb21ib1N0ciAmJlxuICAgIHR5cGVvZiBrZXlDb21ib1N0ciA9PT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2Yga2V5Q29tYm9TdHIubGVuZ3RoID09PSAnbnVtYmVyJ1xuICApIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleUNvbWJvU3RyLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICB0aGlzLmJpbmQoa2V5Q29tYm9TdHJbaV0sIHByZXNzSGFuZGxlciwgcmVsZWFzZUhhbmRsZXIpO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLl9saXN0ZW5lcnMucHVzaCh7XG4gICAga2V5Q29tYm8gICAgICAgICAgICAgICA6IGtleUNvbWJvU3RyID8gbmV3IEtleUNvbWJvKGtleUNvbWJvU3RyKSA6IG51bGwsXG4gICAgcHJlc3NIYW5kbGVyICAgICAgICAgICA6IHByZXNzSGFuZGxlciAgICAgICAgICAgfHwgbnVsbCxcbiAgICByZWxlYXNlSGFuZGxlciAgICAgICAgIDogcmVsZWFzZUhhbmRsZXIgICAgICAgICB8fCBudWxsLFxuICAgIHByZXZlbnRSZXBlYXQgICAgICAgICAgOiBwcmV2ZW50UmVwZWF0QnlEZWZhdWx0IHx8IGZhbHNlLFxuICAgIHByZXZlbnRSZXBlYXRCeURlZmF1bHQgOiBwcmV2ZW50UmVwZWF0QnlEZWZhdWx0IHx8IGZhbHNlXG4gIH0pO1xufTtcbktleWJvYXJkLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IEtleWJvYXJkLnByb3RvdHlwZS5iaW5kO1xuS2V5Ym9hcmQucHJvdG90eXBlLm9uICAgICAgICAgID0gS2V5Ym9hcmQucHJvdG90eXBlLmJpbmQ7XG5cbktleWJvYXJkLnByb3RvdHlwZS51bmJpbmQgPSBmdW5jdGlvbihrZXlDb21ib1N0ciwgcHJlc3NIYW5kbGVyLCByZWxlYXNlSGFuZGxlcikge1xuICBpZiAoa2V5Q29tYm9TdHIgPT09IG51bGwgfHwgdHlwZW9mIGtleUNvbWJvU3RyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmVsZWFzZUhhbmRsZXIgPSBwcmVzc0hhbmRsZXI7XG4gICAgcHJlc3NIYW5kbGVyICAgPSBrZXlDb21ib1N0cjtcbiAgICBrZXlDb21ib1N0ciA9IG51bGw7XG4gIH1cblxuICBpZiAoXG4gICAga2V5Q29tYm9TdHIgJiZcbiAgICB0eXBlb2Yga2V5Q29tYm9TdHIgPT09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIGtleUNvbWJvU3RyLmxlbmd0aCA9PT0gJ251bWJlcidcbiAgKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlDb21ib1N0ci5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgdGhpcy51bmJpbmQoa2V5Q29tYm9TdHJbaV0sIHByZXNzSGFuZGxlciwgcmVsZWFzZUhhbmRsZXIpO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2xpc3RlbmVycy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIHZhciBsaXN0ZW5lciA9IHRoaXMuX2xpc3RlbmVyc1tpXTtcblxuICAgIHZhciBjb21ib01hdGNoZXMgICAgICAgICAgPSAha2V5Q29tYm9TdHIgJiYgIWxpc3RlbmVyLmtleUNvbWJvIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpc3RlbmVyLmtleUNvbWJvICYmIGxpc3RlbmVyLmtleUNvbWJvLmlzRXF1YWwoa2V5Q29tYm9TdHIpO1xuICAgIHZhciBwcmVzc0hhbmRsZXJNYXRjaGVzICAgPSAhcHJlc3NIYW5kbGVyICYmICFyZWxlYXNlSGFuZGxlciB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhcHJlc3NIYW5kbGVyICYmICFsaXN0ZW5lci5wcmVzc0hhbmRsZXIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlc3NIYW5kbGVyID09PSBsaXN0ZW5lci5wcmVzc0hhbmRsZXI7XG4gICAgdmFyIHJlbGVhc2VIYW5kbGVyTWF0Y2hlcyA9ICFwcmVzc0hhbmRsZXIgJiYgIXJlbGVhc2VIYW5kbGVyIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICFyZWxlYXNlSGFuZGxlciAmJiAhbGlzdGVuZXIucmVsZWFzZUhhbmRsZXIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsZWFzZUhhbmRsZXIgPT09IGxpc3RlbmVyLnJlbGVhc2VIYW5kbGVyO1xuXG4gICAgaWYgKGNvbWJvTWF0Y2hlcyAmJiBwcmVzc0hhbmRsZXJNYXRjaGVzICYmIHJlbGVhc2VIYW5kbGVyTWF0Y2hlcykge1xuICAgICAgdGhpcy5fbGlzdGVuZXJzLnNwbGljZShpLCAxKTtcbiAgICAgIGkgLT0gMTtcbiAgICB9XG4gIH1cbn07XG5LZXlib2FyZC5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBLZXlib2FyZC5wcm90b3R5cGUudW5iaW5kO1xuS2V5Ym9hcmQucHJvdG90eXBlLm9mZiAgICAgICAgICAgID0gS2V5Ym9hcmQucHJvdG90eXBlLnVuYmluZDtcblxuS2V5Ym9hcmQucHJvdG90eXBlLnNldENvbnRleHQgPSBmdW5jdGlvbihjb250ZXh0TmFtZSkge1xuICBpZih0aGlzLl9sb2NhbGUpIHsgdGhpcy5yZWxlYXNlQWxsS2V5cygpOyB9XG5cbiAgaWYgKCF0aGlzLl9jb250ZXh0c1tjb250ZXh0TmFtZV0pIHtcbiAgICB0aGlzLl9jb250ZXh0c1tjb250ZXh0TmFtZV0gPSBbXTtcbiAgfVxuICB0aGlzLl9saXN0ZW5lcnMgICAgICA9IHRoaXMuX2NvbnRleHRzW2NvbnRleHROYW1lXTtcbiAgdGhpcy5fY3VycmVudENvbnRleHQgPSBjb250ZXh0TmFtZTtcbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS5nZXRDb250ZXh0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9jdXJyZW50Q29udGV4dDtcbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS53aXRoQ29udGV4dCA9IGZ1bmN0aW9uKGNvbnRleHROYW1lLCBjYWxsYmFjaykge1xuICB2YXIgcHJldmlvdXNDb250ZXh0TmFtZSA9IHRoaXMuZ2V0Q29udGV4dCgpO1xuICB0aGlzLnNldENvbnRleHQoY29udGV4dE5hbWUpO1xuXG4gIGNhbGxiYWNrKCk7XG5cbiAgdGhpcy5zZXRDb250ZXh0KHByZXZpb3VzQ29udGV4dE5hbWUpO1xufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLndhdGNoID0gZnVuY3Rpb24odGFyZ2V0V2luZG93LCB0YXJnZXRFbGVtZW50LCB0YXJnZXRQbGF0Zm9ybSwgdGFyZ2V0VXNlckFnZW50KSB7XG4gIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgdGhpcy5zdG9wKCk7XG5cbiAgaWYgKCF0YXJnZXRXaW5kb3cpIHtcbiAgICBpZiAoIWdsb2JhbC5hZGRFdmVudExpc3RlbmVyICYmICFnbG9iYWwuYXR0YWNoRXZlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZpbmQgZ2xvYmFsIGZ1bmN0aW9ucyBhZGRFdmVudExpc3RlbmVyIG9yIGF0dGFjaEV2ZW50LicpO1xuICAgIH1cbiAgICB0YXJnZXRXaW5kb3cgPSBnbG9iYWw7XG4gIH1cblxuICBpZiAodHlwZW9mIHRhcmdldFdpbmRvdy5ub2RlVHlwZSA9PT0gJ251bWJlcicpIHtcbiAgICB0YXJnZXRVc2VyQWdlbnQgPSB0YXJnZXRQbGF0Zm9ybTtcbiAgICB0YXJnZXRQbGF0Zm9ybSAgPSB0YXJnZXRFbGVtZW50O1xuICAgIHRhcmdldEVsZW1lbnQgICA9IHRhcmdldFdpbmRvdztcbiAgICB0YXJnZXRXaW5kb3cgICAgPSBnbG9iYWw7XG4gIH1cblxuICBpZiAoIXRhcmdldFdpbmRvdy5hZGRFdmVudExpc3RlbmVyICYmICF0YXJnZXRXaW5kb3cuYXR0YWNoRXZlbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBmaW5kIGFkZEV2ZW50TGlzdGVuZXIgb3IgYXR0YWNoRXZlbnQgbWV0aG9kcyBvbiB0YXJnZXRXaW5kb3cuJyk7XG4gIH1cblxuICB0aGlzLl9pc01vZGVybkJyb3dzZXIgPSAhIXRhcmdldFdpbmRvdy5hZGRFdmVudExpc3RlbmVyO1xuXG4gIHZhciB1c2VyQWdlbnQgPSB0YXJnZXRXaW5kb3cubmF2aWdhdG9yICYmIHRhcmdldFdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50IHx8ICcnO1xuICB2YXIgcGxhdGZvcm0gID0gdGFyZ2V0V2luZG93Lm5hdmlnYXRvciAmJiB0YXJnZXRXaW5kb3cubmF2aWdhdG9yLnBsYXRmb3JtICB8fCAnJztcblxuICB0YXJnZXRFbGVtZW50ICAgJiYgdGFyZ2V0RWxlbWVudCAgICE9PSBudWxsIHx8ICh0YXJnZXRFbGVtZW50ICAgPSB0YXJnZXRXaW5kb3cuZG9jdW1lbnQpO1xuICB0YXJnZXRQbGF0Zm9ybSAgJiYgdGFyZ2V0UGxhdGZvcm0gICE9PSBudWxsIHx8ICh0YXJnZXRQbGF0Zm9ybSAgPSBwbGF0Zm9ybSk7XG4gIHRhcmdldFVzZXJBZ2VudCAmJiB0YXJnZXRVc2VyQWdlbnQgIT09IG51bGwgfHwgKHRhcmdldFVzZXJBZ2VudCA9IHVzZXJBZ2VudCk7XG5cbiAgdGhpcy5fdGFyZ2V0S2V5RG93bkJpbmRpbmcgPSBmdW5jdGlvbihldmVudCkge1xuICAgIF90aGlzLnByZXNzS2V5KGV2ZW50LmtleUNvZGUsIGV2ZW50KTtcbiAgICBfdGhpcy5faGFuZGxlQ29tbWFuZEJ1ZyhldmVudCwgcGxhdGZvcm0pO1xuICB9O1xuICB0aGlzLl90YXJnZXRLZXlVcEJpbmRpbmcgPSBmdW5jdGlvbihldmVudCkge1xuICAgIF90aGlzLnJlbGVhc2VLZXkoZXZlbnQua2V5Q29kZSwgZXZlbnQpO1xuICB9O1xuICB0aGlzLl90YXJnZXRSZXNldEJpbmRpbmcgPSBmdW5jdGlvbihldmVudCkge1xuICAgIF90aGlzLnJlbGVhc2VBbGxLZXlzKGV2ZW50KVxuICB9O1xuXG4gIHRoaXMuX2JpbmRFdmVudCh0YXJnZXRFbGVtZW50LCAna2V5ZG93bicsIHRoaXMuX3RhcmdldEtleURvd25CaW5kaW5nKTtcbiAgdGhpcy5fYmluZEV2ZW50KHRhcmdldEVsZW1lbnQsICdrZXl1cCcsICAgdGhpcy5fdGFyZ2V0S2V5VXBCaW5kaW5nKTtcbiAgdGhpcy5fYmluZEV2ZW50KHRhcmdldFdpbmRvdywgICdmb2N1cycsICAgdGhpcy5fdGFyZ2V0UmVzZXRCaW5kaW5nKTtcbiAgdGhpcy5fYmluZEV2ZW50KHRhcmdldFdpbmRvdywgICdibHVyJywgICAgdGhpcy5fdGFyZ2V0UmVzZXRCaW5kaW5nKTtcblxuICB0aGlzLl90YXJnZXRFbGVtZW50ICAgPSB0YXJnZXRFbGVtZW50O1xuICB0aGlzLl90YXJnZXRXaW5kb3cgICAgPSB0YXJnZXRXaW5kb3c7XG4gIHRoaXMuX3RhcmdldFBsYXRmb3JtICA9IHRhcmdldFBsYXRmb3JtO1xuICB0aGlzLl90YXJnZXRVc2VyQWdlbnQgPSB0YXJnZXRVc2VyQWdlbnQ7XG59O1xuXG5LZXlib2FyZC5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gIGlmICghdGhpcy5fdGFyZ2V0RWxlbWVudCB8fCAhdGhpcy5fdGFyZ2V0V2luZG93KSB7IHJldHVybjsgfVxuXG4gIHRoaXMuX3VuYmluZEV2ZW50KHRoaXMuX3RhcmdldEVsZW1lbnQsICdrZXlkb3duJywgdGhpcy5fdGFyZ2V0S2V5RG93bkJpbmRpbmcpO1xuICB0aGlzLl91bmJpbmRFdmVudCh0aGlzLl90YXJnZXRFbGVtZW50LCAna2V5dXAnLCAgIHRoaXMuX3RhcmdldEtleVVwQmluZGluZyk7XG4gIHRoaXMuX3VuYmluZEV2ZW50KHRoaXMuX3RhcmdldFdpbmRvdywgICdmb2N1cycsICAgdGhpcy5fdGFyZ2V0UmVzZXRCaW5kaW5nKTtcbiAgdGhpcy5fdW5iaW5kRXZlbnQodGhpcy5fdGFyZ2V0V2luZG93LCAgJ2JsdXInLCAgICB0aGlzLl90YXJnZXRSZXNldEJpbmRpbmcpO1xuXG4gIHRoaXMuX3RhcmdldFdpbmRvdyAgPSBudWxsO1xuICB0aGlzLl90YXJnZXRFbGVtZW50ID0gbnVsbDtcbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS5wcmVzc0tleSA9IGZ1bmN0aW9uKGtleUNvZGUsIGV2ZW50KSB7XG4gIGlmICh0aGlzLl9wYXVzZWQpIHsgcmV0dXJuOyB9XG4gIGlmICghdGhpcy5fbG9jYWxlKSB7IHRocm93IG5ldyBFcnJvcignTG9jYWxlIG5vdCBzZXQnKTsgfVxuXG4gIHRoaXMuX2xvY2FsZS5wcmVzc0tleShrZXlDb2RlKTtcbiAgdGhpcy5fYXBwbHlCaW5kaW5ncyhldmVudCk7XG59O1xuXG5LZXlib2FyZC5wcm90b3R5cGUucmVsZWFzZUtleSA9IGZ1bmN0aW9uKGtleUNvZGUsIGV2ZW50KSB7XG4gIGlmICh0aGlzLl9wYXVzZWQpIHsgcmV0dXJuOyB9XG4gIGlmICghdGhpcy5fbG9jYWxlKSB7IHRocm93IG5ldyBFcnJvcignTG9jYWxlIG5vdCBzZXQnKTsgfVxuXG4gIHRoaXMuX2xvY2FsZS5yZWxlYXNlS2V5KGtleUNvZGUpO1xuICB0aGlzLl9jbGVhckJpbmRpbmdzKGV2ZW50KTtcbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS5yZWxlYXNlQWxsS2V5cyA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gIGlmICh0aGlzLl9wYXVzZWQpIHsgcmV0dXJuOyB9XG4gIGlmICghdGhpcy5fbG9jYWxlKSB7IHRocm93IG5ldyBFcnJvcignTG9jYWxlIG5vdCBzZXQnKTsgfVxuXG4gIHRoaXMuX2xvY2FsZS5wcmVzc2VkS2V5cy5sZW5ndGggPSAwO1xuICB0aGlzLl9jbGVhckJpbmRpbmdzKGV2ZW50KTtcbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5fcGF1c2VkKSB7IHJldHVybjsgfVxuICBpZiAodGhpcy5fbG9jYWxlKSB7IHRoaXMucmVsZWFzZUFsbEtleXMoKTsgfVxuICB0aGlzLl9wYXVzZWQgPSB0cnVlO1xufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLl9wYXVzZWQgPSBmYWxzZTtcbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLnJlbGVhc2VBbGxLZXlzKCk7XG4gIHRoaXMuX2xpc3RlbmVycy5sZW5ndGggPSAwO1xufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLl9iaW5kRXZlbnQgPSBmdW5jdGlvbih0YXJnZXRFbGVtZW50LCBldmVudE5hbWUsIGhhbmRsZXIpIHtcbiAgcmV0dXJuIHRoaXMuX2lzTW9kZXJuQnJvd3NlciA/XG4gICAgdGFyZ2V0RWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgaGFuZGxlciwgZmFsc2UpIDpcbiAgICB0YXJnZXRFbGVtZW50LmF0dGFjaEV2ZW50KCdvbicgKyBldmVudE5hbWUsIGhhbmRsZXIpO1xufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLl91bmJpbmRFdmVudCA9IGZ1bmN0aW9uKHRhcmdldEVsZW1lbnQsIGV2ZW50TmFtZSwgaGFuZGxlcikge1xuICByZXR1cm4gdGhpcy5faXNNb2Rlcm5Ccm93c2VyID9cbiAgICB0YXJnZXRFbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBoYW5kbGVyLCBmYWxzZSkgOlxuICAgIHRhcmdldEVsZW1lbnQuZGV0YWNoRXZlbnQoJ29uJyArIGV2ZW50TmFtZSwgaGFuZGxlcik7XG59O1xuXG5LZXlib2FyZC5wcm90b3R5cGUuX2dldEdyb3VwZWRMaXN0ZW5lcnMgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGxpc3RlbmVyR3JvdXBzICAgPSBbXTtcbiAgdmFyIGxpc3RlbmVyR3JvdXBNYXAgPSBbXTtcblxuICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICBpZiAodGhpcy5fY3VycmVudENvbnRleHQgIT09ICdnbG9iYWwnKSB7XG4gICAgbGlzdGVuZXJzID0gW10uY29uY2F0KGxpc3RlbmVycywgdGhpcy5fY29udGV4dHMuZ2xvYmFsKTtcbiAgfVxuXG4gIGxpc3RlbmVycy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICByZXR1cm4gKGIua2V5Q29tYm8gPyBiLmtleUNvbWJvLmtleU5hbWVzLmxlbmd0aCA6IDApIC0gKGEua2V5Q29tYm8gPyBhLmtleUNvbWJvLmtleU5hbWVzLmxlbmd0aCA6IDApO1xuICB9KS5mb3JFYWNoKGZ1bmN0aW9uKGwpIHtcbiAgICB2YXIgbWFwSW5kZXggPSAtMTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3RlbmVyR3JvdXBNYXAubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgIGlmIChsaXN0ZW5lckdyb3VwTWFwW2ldID09PSBudWxsICYmIGwua2V5Q29tYm8gPT09IG51bGwgfHxcbiAgICAgICAgICBsaXN0ZW5lckdyb3VwTWFwW2ldICE9PSBudWxsICYmIGxpc3RlbmVyR3JvdXBNYXBbaV0uaXNFcXVhbChsLmtleUNvbWJvKSkge1xuICAgICAgICBtYXBJbmRleCA9IGk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChtYXBJbmRleCA9PT0gLTEpIHtcbiAgICAgIG1hcEluZGV4ID0gbGlzdGVuZXJHcm91cE1hcC5sZW5ndGg7XG4gICAgICBsaXN0ZW5lckdyb3VwTWFwLnB1c2gobC5rZXlDb21ibyk7XG4gICAgfVxuICAgIGlmICghbGlzdGVuZXJHcm91cHNbbWFwSW5kZXhdKSB7XG4gICAgICBsaXN0ZW5lckdyb3Vwc1ttYXBJbmRleF0gPSBbXTtcbiAgICB9XG4gICAgbGlzdGVuZXJHcm91cHNbbWFwSW5kZXhdLnB1c2gobCk7XG4gIH0pO1xuICByZXR1cm4gbGlzdGVuZXJHcm91cHM7XG59O1xuXG5cbnZhciBfTUFQID0ge1xuICAgIDg6ICdiYWNrc3BhY2UnLFxuICAgIDk6ICd0YWInLFxuICAgIDEzOiAnZW50ZXInLFxuICAgIDE2OiAnc2hpZnQnLFxuICAgIDE3OiAnY3RybCcsXG4gICAgMTg6ICdhbHQnLFxuICAgIDIwOiAnY2Fwc2xvY2snLFxuICAgIDI3OiAnZXNjJyxcbiAgICAzMjogJ3NwYWNlJyxcbiAgICAzMzogJ3BhZ2V1cCcsXG4gICAgMzQ6ICdwYWdlZG93bicsXG4gICAgMzU6ICdlbmQnLFxuICAgIDM2OiAnaG9tZScsXG4gICAgMzc6ICdsZWZ0JyxcbiAgICAzODogJ3VwJyxcbiAgICAzOTogJ3JpZ2h0JyxcbiAgICA0MDogJ2Rvd24nLFxuICAgIDQ1OiAnaW5zJyxcbiAgICA0NjogJ2RlbCcsXG4gICAgOTE6ICdtZXRhJyxcbiAgICA5MzogJ21ldGEnLFxuICAgIDIyNDogJ21ldGEnXG59O1xuXG4vKipcbiAqIG1hcHBpbmcgZm9yIHNwZWNpYWwgY2hhcmFjdGVycyBzbyB0aGV5IGNhbiBzdXBwb3J0XG4gKlxuICogdGhpcyBkaWN0aW9uYXJ5IGlzIG9ubHkgdXNlZCBpbmNhc2UgeW91IHdhbnQgdG8gYmluZCBhXG4gKiBrZXl1cCBvciBrZXlkb3duIGV2ZW50IHRvIG9uZSBvZiB0aGVzZSBrZXlzXG4gKlxuICogQHR5cGUge09iamVjdH1cbiAqL1xudmFyIF9LRVlDT0RFX01BUCA9IHtcbiAgICAxMDY6ICcqJyxcbiAgICAxMDc6ICcrJyxcbiAgICAxMDk6ICctJyxcbiAgICAxMTA6ICcuJyxcbiAgICAxMTEgOiAnLycsXG4gICAgMTg2OiAnOycsXG4gICAgMTg3OiAnPScsXG4gICAgMTg4OiAnLCcsXG4gICAgMTg5OiAnLScsXG4gICAgMTkwOiAnLicsXG4gICAgMTkxOiAnLycsXG4gICAgMTkyOiAnYCcsXG4gICAgMjE5OiAnWycsXG4gICAgMjIwOiAnXFxcXCcsXG4gICAgMjIxOiAnXScsXG4gICAgMjIyOiAnXFwnJ1xufTtcblxuICAgLyoqXG4gICAgICogdGFrZXMgdGhlIGV2ZW50IGFuZCByZXR1cm5zIHRoZSBrZXkgY2hhcmFjdGVyXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9jaGFyYWN0ZXJGcm9tRXZlbnQoZSkge1xuXG4gICAgICAgIC8vIGZvciBrZXlwcmVzcyBldmVudHMgd2Ugc2hvdWxkIHJldHVybiB0aGUgY2hhcmFjdGVyIGFzIGlzXG4gICAgICAgIGlmIChlLnR5cGUgPT0gJ2tleXByZXNzJykge1xuICAgICAgICAgICAgdmFyIGNoYXJhY3RlciA9IFN0cmluZy5mcm9tQ2hhckNvZGUoZS53aGljaCk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBzaGlmdCBrZXkgaXMgbm90IHByZXNzZWQgdGhlbiBpdCBpcyBzYWZlIHRvIGFzc3VtZVxuICAgICAgICAgICAgLy8gdGhhdCB3ZSB3YW50IHRoZSBjaGFyYWN0ZXIgdG8gYmUgbG93ZXJjYXNlLiAgdGhpcyBtZWFucyBpZlxuICAgICAgICAgICAgLy8geW91IGFjY2lkZW50YWxseSBoYXZlIGNhcHMgbG9jayBvbiB0aGVuIHlvdXIga2V5IGJpbmRpbmdzXG4gICAgICAgICAgICAvLyB3aWxsIGNvbnRpbnVlIHRvIHdvcmtcbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyB0aGUgb25seSBzaWRlIGVmZmVjdCB0aGF0IG1pZ2h0IG5vdCBiZSBkZXNpcmVkIGlzIGlmIHlvdVxuICAgICAgICAgICAgLy8gYmluZCBzb21ldGhpbmcgbGlrZSAnQScgY2F1c2UgeW91IHdhbnQgdG8gdHJpZ2dlciBhblxuICAgICAgICAgICAgLy8gZXZlbnQgd2hlbiBjYXBpdGFsIEEgaXMgcHJlc3NlZCBjYXBzIGxvY2sgd2lsbCBubyBsb25nZXJcbiAgICAgICAgICAgIC8vIHRyaWdnZXIgdGhlIGV2ZW50LiAgc2hpZnQrYSB3aWxsIHRob3VnaC5cbiAgICAgICAgICAgIGlmICghZS5zaGlmdEtleSkge1xuICAgICAgICAgICAgICAgIGNoYXJhY3RlciA9IGNoYXJhY3Rlci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY2hhcmFjdGVyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yIG5vbiBrZXlwcmVzcyBldmVudHMgdGhlIHNwZWNpYWwgbWFwcyBhcmUgbmVlZGVkXG4gICAgICAgIGlmIChfTUFQW2Uud2hpY2hdKSB7XG4gICAgICAgICAgICByZXR1cm4gX01BUFtlLndoaWNoXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfS0VZQ09ERV9NQVBbZS53aGljaF0pIHtcbiAgICAgICAgICAgIHJldHVybiBfS0VZQ09ERV9NQVBbZS53aGljaF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBpdCBpcyBub3QgaW4gdGhlIHNwZWNpYWwgbWFwXG5cbiAgICAgICAgLy8gd2l0aCBrZXlkb3duIGFuZCBrZXl1cCBldmVudHMgdGhlIGNoYXJhY3RlciBzZWVtcyB0byBhbHdheXNcbiAgICAgICAgLy8gY29tZSBpbiBhcyBhbiB1cHBlcmNhc2UgY2hhcmFjdGVyIHdoZXRoZXIgeW91IGFyZSBwcmVzc2luZyBzaGlmdFxuICAgICAgICAvLyBvciBub3QuICB3ZSBzaG91bGQgbWFrZSBzdXJlIGl0IGlzIGFsd2F5cyBsb3dlcmNhc2UgZm9yIGNvbXBhcmlzb25zXG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGUud2hpY2gpLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuXG5LZXlib2FyZC5wcm90b3R5cGUuX2FwcGx5QmluZGluZ3MgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGNvbnNvbGUubG9nKFwiX2FwcGx5QmluZGluZ3NcIiwgZXZlbnQpXG4gICAgaWYgKHR5cGVvZiBldmVudC53aGljaCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgZXZlbnQud2hpY2ggPSBldmVudC5rZXlDb2RlO1xuICAgIH1cblxuICAgIHZhciBjaGFyYWN0ZXIgPSBfY2hhcmFjdGVyRnJvbUV2ZW50KGV2ZW50KTtcbiAgdmFyIHByZXZlbnRSZXBlYXQgPSBmYWxzZTtcblxuICBldmVudCB8fCAoZXZlbnQgPSB7fSk7XG4gIGV2ZW50LnByZXZlbnRSZXBlYXQgPSBmdW5jdGlvbigpIHsgcHJldmVudFJlcGVhdCA9IHRydWU7IH07XG4gIGV2ZW50LnByZXNzZWRLZXlzICAgPSB0aGlzLl9sb2NhbGUucHJlc3NlZEtleXMuc2xpY2UoMCk7XG5cbiAgdmFyIHByZXNzZWRLZXlzICAgID0gdGhpcy5fbG9jYWxlLnByZXNzZWRLZXlzLnNsaWNlKDApO1xuICB2YXIgbGlzdGVuZXJHcm91cHMgPSB0aGlzLl9nZXRHcm91cGVkTGlzdGVuZXJzKCk7XG5cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3RlbmVyR3JvdXBzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgdmFyIGxpc3RlbmVycyA9IGxpc3RlbmVyR3JvdXBzW2ldO1xuICAgIHZhciBrZXlDb21ibyAgPSBsaXN0ZW5lcnNbMF0ua2V5Q29tYm87XG5cbiAgICBpZiAoa2V5Q29tYm8gPT09IG51bGwgfHwga2V5Q29tYm8uY2hlY2socHJlc3NlZEtleXMpKSB7XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGxpc3RlbmVycy5sZW5ndGg7IGogKz0gMSkge1xuICAgICAgICB2YXIgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbal07XG5cbiAgICAgICAgaWYgKGtleUNvbWJvID09PSBudWxsKSB7XG4gICAgICAgICAgbGlzdGVuZXIgPSB7XG4gICAgICAgICAgICBrZXlDb21ibyAgICAgICAgICAgICAgIDogbmV3IEtleUNvbWJvKHByZXNzZWRLZXlzLmpvaW4oJysnKSksXG4gICAgICAgICAgICBwcmVzc0hhbmRsZXIgICAgICAgICAgIDogbGlzdGVuZXIucHJlc3NIYW5kbGVyLFxuICAgICAgICAgICAgcmVsZWFzZUhhbmRsZXIgICAgICAgICA6IGxpc3RlbmVyLnJlbGVhc2VIYW5kbGVyLFxuICAgICAgICAgICAgcHJldmVudFJlcGVhdCAgICAgICAgICA6IGxpc3RlbmVyLnByZXZlbnRSZXBlYXQsXG4gICAgICAgICAgICBwcmV2ZW50UmVwZWF0QnlEZWZhdWx0IDogbGlzdGVuZXIucHJldmVudFJlcGVhdEJ5RGVmYXVsdFxuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGlzdGVuZXIucHJlc3NIYW5kbGVyICYmICFsaXN0ZW5lci5wcmV2ZW50UmVwZWF0KSB7XG4gICAgICAgICAgbGlzdGVuZXIucHJlc3NIYW5kbGVyLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICAgIGlmIChwcmV2ZW50UmVwZWF0KSB7XG4gICAgICAgICAgICBsaXN0ZW5lci5wcmV2ZW50UmVwZWF0ID0gcHJldmVudFJlcGVhdDtcbiAgICAgICAgICAgIHByZXZlbnRSZXBlYXQgICAgICAgICAgPSBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGlzdGVuZXIucmVsZWFzZUhhbmRsZXIgJiYgdGhpcy5fYXBwbGllZExpc3RlbmVycy5pbmRleE9mKGxpc3RlbmVyKSA9PT0gLTEpIHtcbiAgICAgICAgICB0aGlzLl9hcHBsaWVkTGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChrZXlDb21ibykge1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGtleUNvbWJvLmtleU5hbWVzLmxlbmd0aDsgaiArPSAxKSB7XG4gICAgICAgICAgdmFyIGluZGV4ID0gcHJlc3NlZEtleXMuaW5kZXhPZihrZXlDb21iby5rZXlOYW1lc1tqXSk7XG4gICAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgcHJlc3NlZEtleXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIGogLT0gMTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbktleWJvYXJkLnByb3RvdHlwZS5fY2xlYXJCaW5kaW5ncyA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gIGV2ZW50IHx8IChldmVudCA9IHt9KTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX2FwcGxpZWRMaXN0ZW5lcnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICB2YXIgbGlzdGVuZXIgPSB0aGlzLl9hcHBsaWVkTGlzdGVuZXJzW2ldO1xuICAgIHZhciBrZXlDb21ibyA9IGxpc3RlbmVyLmtleUNvbWJvO1xuICAgIGlmIChrZXlDb21ibyA9PT0gbnVsbCB8fCAha2V5Q29tYm8uY2hlY2sodGhpcy5fbG9jYWxlLnByZXNzZWRLZXlzKSkge1xuICAgICAgaWYgKHRoaXMuX2NhbGxlckhhbmRsZXIgIT09IGxpc3RlbmVyLnJlbGVhc2VIYW5kbGVyKSB7XG4gICAgICAgIHZhciBvbGRDYWxsZXIgPSB0aGlzLl9jYWxsZXJIYW5kbGVyO1xuICAgICAgICB0aGlzLl9jYWxsZXJIYW5kbGVyID0gbGlzdGVuZXIucmVsZWFzZUhhbmRsZXI7XG4gICAgICAgIGxpc3RlbmVyLnByZXZlbnRSZXBlYXQgPSBsaXN0ZW5lci5wcmV2ZW50UmVwZWF0QnlEZWZhdWx0O1xuICAgICAgICBsaXN0ZW5lci5yZWxlYXNlSGFuZGxlci5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICAgICAgdGhpcy5fY2FsbGVySGFuZGxlciA9IG9sZENhbGxlcjtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2FwcGxpZWRMaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgaSAtPSAxO1xuICAgIH1cbiAgfVxufTtcblxuS2V5Ym9hcmQucHJvdG90eXBlLl9oYW5kbGVDb21tYW5kQnVnID0gZnVuY3Rpb24oZXZlbnQsIHBsYXRmb3JtKSB7XG4gIC8vIE9uIE1hYyB3aGVuIHRoZSBjb21tYW5kIGtleSBpcyBrZXB0IHByZXNzZWQsIGtleXVwIGlzIG5vdCB0cmlnZ2VyZWQgZm9yIGFueSBvdGhlciBrZXkuXG4gIC8vIEluIHRoaXMgY2FzZSBmb3JjZSBhIGtleXVwIGZvciBub24tbW9kaWZpZXIga2V5cyBkaXJlY3RseSBhZnRlciB0aGUga2V5cHJlc3MuXG4gIHZhciBtb2RpZmllcktleXMgPSBbXCJzaGlmdFwiLCBcImN0cmxcIiwgXCJhbHRcIiwgXCJjYXBzbG9ja1wiLCBcInRhYlwiLCBcImNvbW1hbmRcIl07XG4gIGlmIChwbGF0Zm9ybS5tYXRjaChcIk1hY1wiKSAmJiB0aGlzLl9sb2NhbGUucHJlc3NlZEtleXMuaW5jbHVkZXMoXCJjb21tYW5kXCIpICYmXG4gICAgICAhbW9kaWZpZXJLZXlzLmluY2x1ZGVzKHRoaXMuX2xvY2FsZS5nZXRLZXlOYW1lcyhldmVudC5rZXlDb2RlKVswXSkpIHtcbiAgICB0aGlzLl90YXJnZXRLZXlVcEJpbmRpbmcoZXZlbnQpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEtleWJvYXJkO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYklteHBZaTlyWlhsaWIyRnlaQzVxY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pTzBGQlFVRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWx4dWRtRnlJRXh2WTJGc1pTQTlJSEpsY1hWcGNtVW9KeTR2Ykc5allXeGxKeWs3WEc1MllYSWdTMlY1UTI5dFltOGdQU0J5WlhGMWFYSmxLQ2N1TDJ0bGVTMWpiMjFpYnljcE8xeHVYRzVjYm1aMWJtTjBhVzl1SUV0bGVXSnZZWEprS0hSaGNtZGxkRmRwYm1SdmR5d2dkR0Z5WjJWMFJXeGxiV1Z1ZEN3Z2NHeGhkR1p2Y20wc0lIVnpaWEpCWjJWdWRDa2dlMXh1SUNCMGFHbHpMbDlzYjJOaGJHVWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBOUlHNTFiR3c3WEc0Z0lIUm9hWE11WDJOMWNuSmxiblJEYjI1MFpYaDBJQ0FnSUNBZ0lEMGdiblZzYkR0Y2JpQWdkR2hwY3k1ZlkyOXVkR1Y0ZEhNZ0lDQWdJQ0FnSUNBZ0lDQWdQU0I3ZlR0Y2JpQWdkR2hwY3k1ZmJHbHpkR1Z1WlhKeklDQWdJQ0FnSUNBZ0lDQWdQU0JiWFR0Y2JpQWdkR2hwY3k1ZllYQndiR2xsWkV4cGMzUmxibVZ5Y3lBZ0lDQWdQU0JiWFR0Y2JpQWdkR2hwY3k1ZmJHOWpZV3hsY3lBZ0lDQWdJQ0FnSUNBZ0lDQWdQU0I3ZlR0Y2JpQWdkR2hwY3k1ZmRHRnlaMlYwUld4bGJXVnVkQ0FnSUNBZ0lDQWdQU0J1ZFd4c08xeHVJQ0IwYUdsekxsOTBZWEpuWlhSWGFXNWtiM2NnSUNBZ0lDQWdJQ0E5SUc1MWJHdzdYRzRnSUhSb2FYTXVYM1JoY21kbGRGQnNZWFJtYjNKdElDQWdJQ0FnSUQwZ0p5YzdYRzRnSUhSb2FYTXVYM1JoY21kbGRGVnpaWEpCWjJWdWRDQWdJQ0FnSUQwZ0p5YzdYRzRnSUhSb2FYTXVYMmx6VFc5a1pYSnVRbkp2ZDNObGNpQWdJQ0FnSUQwZ1ptRnNjMlU3WEc0Z0lIUm9hWE11WDNSaGNtZGxkRXRsZVVSdmQyNUNhVzVrYVc1bklEMGdiblZzYkR0Y2JpQWdkR2hwY3k1ZmRHRnlaMlYwUzJWNVZYQkNhVzVrYVc1bklDQWdQU0J1ZFd4c08xeHVJQ0IwYUdsekxsOTBZWEpuWlhSU1pYTmxkRUpwYm1ScGJtY2dJQ0E5SUc1MWJHdzdYRzRnSUhSb2FYTXVYM0JoZFhObFpDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUQwZ1ptRnNjMlU3WEc0Z0lIUm9hWE11WDJOaGJHeGxja2hoYm1Sc1pYSWdJQ0FnSUNBZ0lEMGdiblZzYkR0Y2JseHVJQ0IwYUdsekxuTmxkRU52Ym5SbGVIUW9KMmRzYjJKaGJDY3BPMXh1SUNCMGFHbHpMbmRoZEdOb0tIUmhjbWRsZEZkcGJtUnZkeXdnZEdGeVoyVjBSV3hsYldWdWRDd2djR3hoZEdadmNtMHNJSFZ6WlhKQloyVnVkQ2s3WEc1OVhHNWNia3RsZVdKdllYSmtMbkJ5YjNSdmRIbHdaUzV6WlhSTWIyTmhiR1VnUFNCbWRXNWpkR2x2Ymloc2IyTmhiR1ZPWVcxbExDQnNiMk5oYkdWQ2RXbHNaR1Z5S1NCN1hHNGdJSFpoY2lCc2IyTmhiR1VnUFNCdWRXeHNPMXh1SUNCcFppQW9kSGx3Wlc5bUlHeHZZMkZzWlU1aGJXVWdQVDA5SUNkemRISnBibWNuS1NCN1hHNWNiaUFnSUNCcFppQW9iRzlqWVd4bFFuVnBiR1JsY2lrZ2UxeHVJQ0FnSUNBZ2JHOWpZV3hsSUQwZ2JtVjNJRXh2WTJGc1pTaHNiMk5oYkdWT1lXMWxLVHRjYmlBZ0lDQWdJR3h2WTJGc1pVSjFhV3hrWlhJb2JHOWpZV3hsTENCMGFHbHpMbDkwWVhKblpYUlFiR0YwWm05eWJTd2dkR2hwY3k1ZmRHRnlaMlYwVlhObGNrRm5aVzUwS1R0Y2JpQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdiRzlqWVd4bElEMGdkR2hwY3k1ZmJHOWpZV3hsYzF0c2IyTmhiR1ZPWVcxbFhTQjhmQ0J1ZFd4c08xeHVJQ0FnSUgxY2JpQWdmU0JsYkhObElIdGNiaUFnSUNCc2IyTmhiR1VnSUNBZ0lEMGdiRzlqWVd4bFRtRnRaVHRjYmlBZ0lDQnNiMk5oYkdWT1lXMWxJRDBnYkc5allXeGxMbDlzYjJOaGJHVk9ZVzFsTzF4dUlDQjlYRzVjYmlBZ2RHaHBjeTVmYkc5allXeGxJQ0FnSUNBZ0lDQWdJQ0FnSUNBOUlHeHZZMkZzWlR0Y2JpQWdkR2hwY3k1ZmJHOWpZV3hsYzF0c2IyTmhiR1ZPWVcxbFhTQTlJR3h2WTJGc1pUdGNiaUFnYVdZZ0tHeHZZMkZzWlNrZ2UxeHVJQ0FnSUhSb2FYTXVYMnh2WTJGc1pTNXdjbVZ6YzJWa1MyVjVjeUE5SUd4dlkyRnNaUzV3Y21WemMyVmtTMlY1Y3p0Y2JpQWdmVnh1ZlR0Y2JseHVTMlY1WW05aGNtUXVjSEp2ZEc5MGVYQmxMbWRsZEV4dlkyRnNaU0E5SUdaMWJtTjBhVzl1S0d4dlkyRnNUbUZ0WlNrZ2UxeHVJQ0JzYjJOaGJFNWhiV1VnZkh3Z0tHeHZZMkZzVG1GdFpTQTlJSFJvYVhNdVgyeHZZMkZzWlM1c2IyTmhiR1ZPWVcxbEtUdGNiaUFnY21WMGRYSnVJSFJvYVhNdVgyeHZZMkZzWlhOYmJHOWpZV3hPWVcxbFhTQjhmQ0J1ZFd4c08xeHVmVHRjYmx4dVMyVjVZbTloY21RdWNISnZkRzkwZVhCbExtSnBibVFnUFNCbWRXNWpkR2x2YmloclpYbERiMjFpYjFOMGNpd2djSEpsYzNOSVlXNWtiR1Z5TENCeVpXeGxZWE5sU0dGdVpHeGxjaXdnY0hKbGRtVnVkRkpsY0dWaGRFSjVSR1ZtWVhWc2RDa2dlMXh1SUNCcFppQW9hMlY1UTI5dFltOVRkSElnUFQwOUlHNTFiR3dnZkh3Z2RIbHdaVzltSUd0bGVVTnZiV0p2VTNSeUlEMDlQU0FuWm5WdVkzUnBiMjRuS1NCN1hHNGdJQ0FnY0hKbGRtVnVkRkpsY0dWaGRFSjVSR1ZtWVhWc2RDQTlJSEpsYkdWaGMyVklZVzVrYkdWeU8xeHVJQ0FnSUhKbGJHVmhjMlZJWVc1a2JHVnlJQ0FnSUNBZ0lDQWdQU0J3Y21WemMwaGhibVJzWlhJN1hHNGdJQ0FnY0hKbGMzTklZVzVrYkdWeUlDQWdJQ0FnSUNBZ0lDQTlJR3RsZVVOdmJXSnZVM1J5TzF4dUlDQWdJR3RsZVVOdmJXSnZVM1J5SUNBZ0lDQWdJQ0FnSUNBZ1BTQnVkV3hzTzF4dUlDQjlYRzVjYmlBZ2FXWWdLRnh1SUNBZ0lHdGxlVU52YldKdlUzUnlJQ1ltWEc0Z0lDQWdkSGx3Wlc5bUlHdGxlVU52YldKdlUzUnlJRDA5UFNBbmIySnFaV04wSnlBbUpseHVJQ0FnSUhSNWNHVnZaaUJyWlhsRGIyMWliMU4wY2k1c1pXNW5kR2dnUFQwOUlDZHVkVzFpWlhJblhHNGdJQ2tnZTF4dUlDQWdJR1p2Y2lBb2RtRnlJR2tnUFNBd095QnBJRHdnYTJWNVEyOXRZbTlUZEhJdWJHVnVaM1JvT3lCcElDczlJREVwSUh0Y2JpQWdJQ0FnSUhSb2FYTXVZbWx1WkNoclpYbERiMjFpYjFOMGNsdHBYU3dnY0hKbGMzTklZVzVrYkdWeUxDQnlaV3hsWVhObFNHRnVaR3hsY2lrN1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJqdGNiaUFnZlZ4dVhHNGdJSFJvYVhNdVgyeHBjM1JsYm1WeWN5NXdkWE5vS0h0Y2JpQWdJQ0JyWlhsRGIyMWlieUFnSUNBZ0lDQWdJQ0FnSUNBZ0lEb2dhMlY1UTI5dFltOVRkSElnUHlCdVpYY2dTMlY1UTI5dFltOG9hMlY1UTI5dFltOVRkSElwSURvZ2JuVnNiQ3hjYmlBZ0lDQndjbVZ6YzBoaGJtUnNaWElnSUNBZ0lDQWdJQ0FnSURvZ2NISmxjM05JWVc1a2JHVnlJQ0FnSUNBZ0lDQWdJQ0I4ZkNCdWRXeHNMRnh1SUNBZ0lISmxiR1ZoYzJWSVlXNWtiR1Z5SUNBZ0lDQWdJQ0FnT2lCeVpXeGxZWE5sU0dGdVpHeGxjaUFnSUNBZ0lDQWdJSHg4SUc1MWJHd3NYRzRnSUNBZ2NISmxkbVZ1ZEZKbGNHVmhkQ0FnSUNBZ0lDQWdJQ0E2SUhCeVpYWmxiblJTWlhCbFlYUkNlVVJsWm1GMWJIUWdmSHdnWm1Gc2MyVXNYRzRnSUNBZ2NISmxkbVZ1ZEZKbGNHVmhkRUo1UkdWbVlYVnNkQ0E2SUhCeVpYWmxiblJTWlhCbFlYUkNlVVJsWm1GMWJIUWdmSHdnWm1Gc2MyVmNiaUFnZlNrN1hHNTlPMXh1UzJWNVltOWhjbVF1Y0hKdmRHOTBlWEJsTG1Ga1pFeHBjM1JsYm1WeUlEMGdTMlY1WW05aGNtUXVjSEp2ZEc5MGVYQmxMbUpwYm1RN1hHNUxaWGxpYjJGeVpDNXdjbTkwYjNSNWNHVXViMjRnSUNBZ0lDQWdJQ0FnUFNCTFpYbGliMkZ5WkM1d2NtOTBiM1I1Y0dVdVltbHVaRHRjYmx4dVMyVjVZbTloY21RdWNISnZkRzkwZVhCbExuVnVZbWx1WkNBOUlHWjFibU4wYVc5dUtHdGxlVU52YldKdlUzUnlMQ0J3Y21WemMwaGhibVJzWlhJc0lISmxiR1ZoYzJWSVlXNWtiR1Z5S1NCN1hHNGdJR2xtSUNoclpYbERiMjFpYjFOMGNpQTlQVDBnYm5Wc2JDQjhmQ0IwZVhCbGIyWWdhMlY1UTI5dFltOVRkSElnUFQwOUlDZG1kVzVqZEdsdmJpY3BJSHRjYmlBZ0lDQnlaV3hsWVhObFNHRnVaR3hsY2lBOUlIQnlaWE56U0dGdVpHeGxjanRjYmlBZ0lDQndjbVZ6YzBoaGJtUnNaWElnSUNBOUlHdGxlVU52YldKdlUzUnlPMXh1SUNBZ0lHdGxlVU52YldKdlUzUnlJRDBnYm5Wc2JEdGNiaUFnZlZ4dVhHNGdJR2xtSUNoY2JpQWdJQ0JyWlhsRGIyMWliMU4wY2lBbUpseHVJQ0FnSUhSNWNHVnZaaUJyWlhsRGIyMWliMU4wY2lBOVBUMGdKMjlpYW1WamRDY2dKaVpjYmlBZ0lDQjBlWEJsYjJZZ2EyVjVRMjl0WW05VGRISXViR1Z1WjNSb0lEMDlQU0FuYm5WdFltVnlKMXh1SUNBcElIdGNiaUFnSUNCbWIzSWdLSFpoY2lCcElEMGdNRHNnYVNBOElHdGxlVU52YldKdlUzUnlMbXhsYm1kMGFEc2dhU0FyUFNBeEtTQjdYRzRnSUNBZ0lDQjBhR2x6TG5WdVltbHVaQ2hyWlhsRGIyMWliMU4wY2x0cFhTd2djSEpsYzNOSVlXNWtiR1Z5TENCeVpXeGxZWE5sU0dGdVpHeGxjaWs3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5Ymp0Y2JpQWdmVnh1WEc0Z0lHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2dkR2hwY3k1ZmJHbHpkR1Z1WlhKekxteGxibWQwYURzZ2FTQXJQU0F4S1NCN1hHNGdJQ0FnZG1GeUlHeHBjM1JsYm1WeUlEMGdkR2hwY3k1ZmJHbHpkR1Z1WlhKelcybGRPMXh1WEc0Z0lDQWdkbUZ5SUdOdmJXSnZUV0YwWTJobGN5QWdJQ0FnSUNBZ0lDQTlJQ0ZyWlhsRGIyMWliMU4wY2lBbUppQWhiR2x6ZEdWdVpYSXVhMlY1UTI5dFltOGdmSHhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiR2x6ZEdWdVpYSXVhMlY1UTI5dFltOGdKaVlnYkdsemRHVnVaWEl1YTJWNVEyOXRZbTh1YVhORmNYVmhiQ2hyWlhsRGIyMWliMU4wY2lrN1hHNGdJQ0FnZG1GeUlIQnlaWE56U0dGdVpHeGxjazFoZEdOb1pYTWdJQ0E5SUNGd2NtVnpjMGhoYm1Sc1pYSWdKaVlnSVhKbGJHVmhjMlZJWVc1a2JHVnlJSHg4WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0Z3Y21WemMwaGhibVJzWlhJZ0ppWWdJV3hwYzNSbGJtVnlMbkJ5WlhOelNHRnVaR3hsY2lCOGZGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCd2NtVnpjMGhoYm1Sc1pYSWdQVDA5SUd4cGMzUmxibVZ5TG5CeVpYTnpTR0Z1Wkd4bGNqdGNiaUFnSUNCMllYSWdjbVZzWldGelpVaGhibVJzWlhKTllYUmphR1Z6SUQwZ0lYQnlaWE56U0dGdVpHeGxjaUFtSmlBaGNtVnNaV0Z6WlVoaGJtUnNaWElnZkh4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSVhKbGJHVmhjMlZJWVc1a2JHVnlJQ1ltSUNGc2FYTjBaVzVsY2k1eVpXeGxZWE5sU0dGdVpHeGxjaUI4ZkZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5Wld4bFlYTmxTR0Z1Wkd4bGNpQTlQVDBnYkdsemRHVnVaWEl1Y21Wc1pXRnpaVWhoYm1Sc1pYSTdYRzVjYmlBZ0lDQnBaaUFvWTI5dFltOU5ZWFJqYUdWeklDWW1JSEJ5WlhOelNHRnVaR3hsY2sxaGRHTm9aWE1nSmlZZ2NtVnNaV0Z6WlVoaGJtUnNaWEpOWVhSamFHVnpLU0I3WEc0Z0lDQWdJQ0IwYUdsekxsOXNhWE4wWlc1bGNuTXVjM0JzYVdObEtHa3NJREVwTzF4dUlDQWdJQ0FnYVNBdFBTQXhPMXh1SUNBZ0lIMWNiaUFnZlZ4dWZUdGNia3RsZVdKdllYSmtMbkJ5YjNSdmRIbHdaUzV5WlcxdmRtVk1hWE4wWlc1bGNpQTlJRXRsZVdKdllYSmtMbkJ5YjNSdmRIbHdaUzUxYm1KcGJtUTdYRzVMWlhsaWIyRnlaQzV3Y205MGIzUjVjR1V1YjJabUlDQWdJQ0FnSUNBZ0lDQWdQU0JMWlhsaWIyRnlaQzV3Y205MGIzUjVjR1V1ZFc1aWFXNWtPMXh1WEc1TFpYbGliMkZ5WkM1d2NtOTBiM1I1Y0dVdWMyVjBRMjl1ZEdWNGRDQTlJR1oxYm1OMGFXOXVLR052Ym5SbGVIUk9ZVzFsS1NCN1hHNGdJR2xtS0hSb2FYTXVYMnh2WTJGc1pTa2dleUIwYUdsekxuSmxiR1ZoYzJWQmJHeExaWGx6S0NrN0lIMWNibHh1SUNCcFppQW9JWFJvYVhNdVgyTnZiblJsZUhSelcyTnZiblJsZUhST1lXMWxYU2tnZTF4dUlDQWdJSFJvYVhNdVgyTnZiblJsZUhSelcyTnZiblJsZUhST1lXMWxYU0E5SUZ0ZE8xeHVJQ0I5WEc0Z0lIUm9hWE11WDJ4cGMzUmxibVZ5Y3lBZ0lDQWdJRDBnZEdocGN5NWZZMjl1ZEdWNGRITmJZMjl1ZEdWNGRFNWhiV1ZkTzF4dUlDQjBhR2x6TGw5amRYSnlaVzUwUTI5dWRHVjRkQ0E5SUdOdmJuUmxlSFJPWVcxbE8xeHVmVHRjYmx4dVMyVjVZbTloY21RdWNISnZkRzkwZVhCbExtZGxkRU52Ym5SbGVIUWdQU0JtZFc1amRHbHZiaWdwSUh0Y2JpQWdjbVYwZFhKdUlIUm9hWE11WDJOMWNuSmxiblJEYjI1MFpYaDBPMXh1ZlR0Y2JseHVTMlY1WW05aGNtUXVjSEp2ZEc5MGVYQmxMbmRwZEdoRGIyNTBaWGgwSUQwZ1puVnVZM1JwYjI0b1kyOXVkR1Y0ZEU1aGJXVXNJR05oYkd4aVlXTnJLU0I3WEc0Z0lIWmhjaUJ3Y21WMmFXOTFjME52Ym5SbGVIUk9ZVzFsSUQwZ2RHaHBjeTVuWlhSRGIyNTBaWGgwS0NrN1hHNGdJSFJvYVhNdWMyVjBRMjl1ZEdWNGRDaGpiMjUwWlhoMFRtRnRaU2s3WEc1Y2JpQWdZMkZzYkdKaFkyc29LVHRjYmx4dUlDQjBhR2x6TG5ObGRFTnZiblJsZUhRb2NISmxkbWx2ZFhORGIyNTBaWGgwVG1GdFpTazdYRzU5TzF4dVhHNUxaWGxpYjJGeVpDNXdjbTkwYjNSNWNHVXVkMkYwWTJnZ1BTQm1kVzVqZEdsdmJpaDBZWEpuWlhSWGFXNWtiM2NzSUhSaGNtZGxkRVZzWlcxbGJuUXNJSFJoY21kbGRGQnNZWFJtYjNKdExDQjBZWEpuWlhSVmMyVnlRV2RsYm5RcElIdGNiaUFnZG1GeUlGOTBhR2x6SUQwZ2RHaHBjenRjYmx4dUlDQjBhR2x6TG5OMGIzQW9LVHRjYmx4dUlDQnBaaUFvSVhSaGNtZGxkRmRwYm1SdmR5a2dlMXh1SUNBZ0lHbG1JQ2doWjJ4dlltRnNMbUZrWkVWMlpXNTBUR2x6ZEdWdVpYSWdKaVlnSVdkc2IySmhiQzVoZEhSaFkyaEZkbVZ1ZENrZ2UxeHVJQ0FnSUNBZ2RHaHliM2NnYm1WM0lFVnljbTl5S0NkRFlXNXViM1FnWm1sdVpDQm5iRzlpWVd3Z1puVnVZM1JwYjI1eklHRmtaRVYyWlc1MFRHbHpkR1Z1WlhJZ2IzSWdZWFIwWVdOb1JYWmxiblF1SnlrN1hHNGdJQ0FnZlZ4dUlDQWdJSFJoY21kbGRGZHBibVJ2ZHlBOUlHZHNiMkpoYkR0Y2JpQWdmVnh1WEc0Z0lHbG1JQ2gwZVhCbGIyWWdkR0Z5WjJWMFYybHVaRzkzTG01dlpHVlVlWEJsSUQwOVBTQW5iblZ0WW1WeUp5a2dlMXh1SUNBZ0lIUmhjbWRsZEZWelpYSkJaMlZ1ZENBOUlIUmhjbWRsZEZCc1lYUm1iM0p0TzF4dUlDQWdJSFJoY21kbGRGQnNZWFJtYjNKdElDQTlJSFJoY21kbGRFVnNaVzFsYm5RN1hHNGdJQ0FnZEdGeVoyVjBSV3hsYldWdWRDQWdJRDBnZEdGeVoyVjBWMmx1Wkc5M08xeHVJQ0FnSUhSaGNtZGxkRmRwYm1SdmR5QWdJQ0E5SUdkc2IySmhiRHRjYmlBZ2ZWeHVYRzRnSUdsbUlDZ2hkR0Z5WjJWMFYybHVaRzkzTG1Ga1pFVjJaVzUwVEdsemRHVnVaWElnSmlZZ0lYUmhjbWRsZEZkcGJtUnZkeTVoZEhSaFkyaEZkbVZ1ZENrZ2UxeHVJQ0FnSUhSb2NtOTNJRzVsZHlCRmNuSnZjaWduUTJGdWJtOTBJR1pwYm1RZ1lXUmtSWFpsYm5STWFYTjBaVzVsY2lCdmNpQmhkSFJoWTJoRmRtVnVkQ0J0WlhSb2IyUnpJRzl1SUhSaGNtZGxkRmRwYm1SdmR5NG5LVHRjYmlBZ2ZWeHVYRzRnSUhSb2FYTXVYMmx6VFc5a1pYSnVRbkp2ZDNObGNpQTlJQ0VoZEdGeVoyVjBWMmx1Wkc5M0xtRmtaRVYyWlc1MFRHbHpkR1Z1WlhJN1hHNWNiaUFnZG1GeUlIVnpaWEpCWjJWdWRDQTlJSFJoY21kbGRGZHBibVJ2ZHk1dVlYWnBaMkYwYjNJZ0ppWWdkR0Z5WjJWMFYybHVaRzkzTG01aGRtbG5ZWFJ2Y2k1MWMyVnlRV2RsYm5RZ2ZId2dKeWM3WEc0Z0lIWmhjaUJ3YkdGMFptOXliU0FnUFNCMFlYSm5aWFJYYVc1a2IzY3VibUYyYVdkaGRHOXlJQ1ltSUhSaGNtZGxkRmRwYm1SdmR5NXVZWFpwWjJGMGIzSXVjR3hoZEdadmNtMGdJSHg4SUNjbk8xeHVYRzRnSUhSaGNtZGxkRVZzWlcxbGJuUWdJQ0FtSmlCMFlYSm5aWFJGYkdWdFpXNTBJQ0FnSVQwOUlHNTFiR3dnZkh3Z0tIUmhjbWRsZEVWc1pXMWxiblFnSUNBOUlIUmhjbWRsZEZkcGJtUnZkeTVrYjJOMWJXVnVkQ2s3WEc0Z0lIUmhjbWRsZEZCc1lYUm1iM0p0SUNBbUppQjBZWEpuWlhSUWJHRjBabTl5YlNBZ0lUMDlJRzUxYkd3Z2ZId2dLSFJoY21kbGRGQnNZWFJtYjNKdElDQTlJSEJzWVhSbWIzSnRLVHRjYmlBZ2RHRnlaMlYwVlhObGNrRm5aVzUwSUNZbUlIUmhjbWRsZEZWelpYSkJaMlZ1ZENBaFBUMGdiblZzYkNCOGZDQW9kR0Z5WjJWMFZYTmxja0ZuWlc1MElEMGdkWE5sY2tGblpXNTBLVHRjYmx4dUlDQjBhR2x6TGw5MFlYSm5aWFJMWlhsRWIzZHVRbWx1WkdsdVp5QTlJR1oxYm1OMGFXOXVLR1YyWlc1MEtTQjdYRzRnSUNBZ1gzUm9hWE11Y0hKbGMzTkxaWGtvWlhabGJuUXVhMlY1UTI5a1pTd2daWFpsYm5RcE8xeHVJQ0FnSUY5MGFHbHpMbDlvWVc1a2JHVkRiMjF0WVc1a1FuVm5LR1YyWlc1MExDQndiR0YwWm05eWJTazdYRzRnSUgwN1hHNGdJSFJvYVhNdVgzUmhjbWRsZEV0bGVWVndRbWx1WkdsdVp5QTlJR1oxYm1OMGFXOXVLR1YyWlc1MEtTQjdYRzRnSUNBZ1gzUm9hWE11Y21Wc1pXRnpaVXRsZVNobGRtVnVkQzVyWlhsRGIyUmxMQ0JsZG1WdWRDazdYRzRnSUgwN1hHNGdJSFJvYVhNdVgzUmhjbWRsZEZKbGMyVjBRbWx1WkdsdVp5QTlJR1oxYm1OMGFXOXVLR1YyWlc1MEtTQjdYRzRnSUNBZ1gzUm9hWE11Y21Wc1pXRnpaVUZzYkV0bGVYTW9aWFpsYm5RcFhHNGdJSDA3WEc1Y2JpQWdkR2hwY3k1ZlltbHVaRVYyWlc1MEtIUmhjbWRsZEVWc1pXMWxiblFzSUNkclpYbGtiM2R1Snl3Z2RHaHBjeTVmZEdGeVoyVjBTMlY1Ukc5M2JrSnBibVJwYm1jcE8xeHVJQ0IwYUdsekxsOWlhVzVrUlhabGJuUW9kR0Z5WjJWMFJXeGxiV1Z1ZEN3Z0oydGxlWFZ3Snl3Z0lDQjBhR2x6TGw5MFlYSm5aWFJMWlhsVmNFSnBibVJwYm1jcE8xeHVJQ0IwYUdsekxsOWlhVzVrUlhabGJuUW9kR0Z5WjJWMFYybHVaRzkzTENBZ0oyWnZZM1Z6Snl3Z0lDQjBhR2x6TGw5MFlYSm5aWFJTWlhObGRFSnBibVJwYm1jcE8xeHVJQ0IwYUdsekxsOWlhVzVrUlhabGJuUW9kR0Z5WjJWMFYybHVaRzkzTENBZ0oySnNkWEluTENBZ0lDQjBhR2x6TGw5MFlYSm5aWFJTWlhObGRFSnBibVJwYm1jcE8xeHVYRzRnSUhSb2FYTXVYM1JoY21kbGRFVnNaVzFsYm5RZ0lDQTlJSFJoY21kbGRFVnNaVzFsYm5RN1hHNGdJSFJvYVhNdVgzUmhjbWRsZEZkcGJtUnZkeUFnSUNBOUlIUmhjbWRsZEZkcGJtUnZkenRjYmlBZ2RHaHBjeTVmZEdGeVoyVjBVR3hoZEdadmNtMGdJRDBnZEdGeVoyVjBVR3hoZEdadmNtMDdYRzRnSUhSb2FYTXVYM1JoY21kbGRGVnpaWEpCWjJWdWRDQTlJSFJoY21kbGRGVnpaWEpCWjJWdWREdGNibjA3WEc1Y2JrdGxlV0p2WVhKa0xuQnliM1J2ZEhsd1pTNXpkRzl3SUQwZ1puVnVZM1JwYjI0b0tTQjdYRzRnSUhaaGNpQmZkR2hwY3lBOUlIUm9hWE03WEc1Y2JpQWdhV1lnS0NGMGFHbHpMbDkwWVhKblpYUkZiR1Z0Wlc1MElIeDhJQ0YwYUdsekxsOTBZWEpuWlhSWGFXNWtiM2NwSUhzZ2NtVjBkWEp1T3lCOVhHNWNiaUFnZEdocGN5NWZkVzVpYVc1a1JYWmxiblFvZEdocGN5NWZkR0Z5WjJWMFJXeGxiV1Z1ZEN3Z0oydGxlV1J2ZDI0bkxDQjBhR2x6TGw5MFlYSm5aWFJMWlhsRWIzZHVRbWx1WkdsdVp5azdYRzRnSUhSb2FYTXVYM1Z1WW1sdVpFVjJaVzUwS0hSb2FYTXVYM1JoY21kbGRFVnNaVzFsYm5Rc0lDZHJaWGwxY0Njc0lDQWdkR2hwY3k1ZmRHRnlaMlYwUzJWNVZYQkNhVzVrYVc1bktUdGNiaUFnZEdocGN5NWZkVzVpYVc1a1JYWmxiblFvZEdocGN5NWZkR0Z5WjJWMFYybHVaRzkzTENBZ0oyWnZZM1Z6Snl3Z0lDQjBhR2x6TGw5MFlYSm5aWFJTWlhObGRFSnBibVJwYm1jcE8xeHVJQ0IwYUdsekxsOTFibUpwYm1SRmRtVnVkQ2gwYUdsekxsOTBZWEpuWlhSWGFXNWtiM2NzSUNBbllteDFjaWNzSUNBZ0lIUm9hWE11WDNSaGNtZGxkRkpsYzJWMFFtbHVaR2x1WnlrN1hHNWNiaUFnZEdocGN5NWZkR0Z5WjJWMFYybHVaRzkzSUNBOUlHNTFiR3c3WEc0Z0lIUm9hWE11WDNSaGNtZGxkRVZzWlcxbGJuUWdQU0J1ZFd4c08xeHVmVHRjYmx4dVMyVjVZbTloY21RdWNISnZkRzkwZVhCbExuQnlaWE56UzJWNUlEMGdablZ1WTNScGIyNG9hMlY1UTI5a1pTd2daWFpsYm5RcElIdGNiaUFnYVdZZ0tIUm9hWE11WDNCaGRYTmxaQ2tnZXlCeVpYUjFjbTQ3SUgxY2JpQWdhV1lnS0NGMGFHbHpMbDlzYjJOaGJHVXBJSHNnZEdoeWIzY2dibVYzSUVWeWNtOXlLQ2RNYjJOaGJHVWdibTkwSUhObGRDY3BPeUI5WEc1Y2JpQWdkR2hwY3k1ZmJHOWpZV3hsTG5CeVpYTnpTMlY1S0d0bGVVTnZaR1VwTzF4dUlDQjBhR2x6TGw5aGNIQnNlVUpwYm1ScGJtZHpLR1YyWlc1MEtUdGNibjA3WEc1Y2JrdGxlV0p2WVhKa0xuQnliM1J2ZEhsd1pTNXlaV3hsWVhObFMyVjVJRDBnWm5WdVkzUnBiMjRvYTJWNVEyOWtaU3dnWlhabGJuUXBJSHRjYmlBZ2FXWWdLSFJvYVhNdVgzQmhkWE5sWkNrZ2V5QnlaWFIxY200N0lIMWNiaUFnYVdZZ0tDRjBhR2x6TGw5c2IyTmhiR1VwSUhzZ2RHaHliM2NnYm1WM0lFVnljbTl5S0NkTWIyTmhiR1VnYm05MElITmxkQ2NwT3lCOVhHNWNiaUFnZEdocGN5NWZiRzlqWVd4bExuSmxiR1ZoYzJWTFpYa29hMlY1UTI5a1pTazdYRzRnSUhSb2FYTXVYMk5zWldGeVFtbHVaR2x1WjNNb1pYWmxiblFwTzF4dWZUdGNibHh1UzJWNVltOWhjbVF1Y0hKdmRHOTBlWEJsTG5KbGJHVmhjMlZCYkd4TFpYbHpJRDBnWm5WdVkzUnBiMjRvWlhabGJuUXBJSHRjYmlBZ2FXWWdLSFJvYVhNdVgzQmhkWE5sWkNrZ2V5QnlaWFIxY200N0lIMWNiaUFnYVdZZ0tDRjBhR2x6TGw5c2IyTmhiR1VwSUhzZ2RHaHliM2NnYm1WM0lFVnljbTl5S0NkTWIyTmhiR1VnYm05MElITmxkQ2NwT3lCOVhHNWNiaUFnZEdocGN5NWZiRzlqWVd4bExuQnlaWE56WldSTFpYbHpMbXhsYm1kMGFDQTlJREE3WEc0Z0lIUm9hWE11WDJOc1pXRnlRbWx1WkdsdVozTW9aWFpsYm5RcE8xeHVmVHRjYmx4dVMyVjVZbTloY21RdWNISnZkRzkwZVhCbExuQmhkWE5sSUQwZ1puVnVZM1JwYjI0b0tTQjdYRzRnSUdsbUlDaDBhR2x6TGw5d1lYVnpaV1FwSUhzZ2NtVjBkWEp1T3lCOVhHNGdJR2xtSUNoMGFHbHpMbDlzYjJOaGJHVXBJSHNnZEdocGN5NXlaV3hsWVhObFFXeHNTMlY1Y3lncE95QjlYRzRnSUhSb2FYTXVYM0JoZFhObFpDQTlJSFJ5ZFdVN1hHNTlPMXh1WEc1TFpYbGliMkZ5WkM1d2NtOTBiM1I1Y0dVdWNtVnpkVzFsSUQwZ1puVnVZM1JwYjI0b0tTQjdYRzRnSUhSb2FYTXVYM0JoZFhObFpDQTlJR1poYkhObE8xeHVmVHRjYmx4dVMyVjVZbTloY21RdWNISnZkRzkwZVhCbExuSmxjMlYwSUQwZ1puVnVZM1JwYjI0b0tTQjdYRzRnSUhSb2FYTXVjbVZzWldGelpVRnNiRXRsZVhNb0tUdGNiaUFnZEdocGN5NWZiR2x6ZEdWdVpYSnpMbXhsYm1kMGFDQTlJREE3WEc1OU8xeHVYRzVMWlhsaWIyRnlaQzV3Y205MGIzUjVjR1V1WDJKcGJtUkZkbVZ1ZENBOUlHWjFibU4wYVc5dUtIUmhjbWRsZEVWc1pXMWxiblFzSUdWMlpXNTBUbUZ0WlN3Z2FHRnVaR3hsY2lrZ2UxeHVJQ0J5WlhSMWNtNGdkR2hwY3k1ZmFYTk5iMlJsY201Q2NtOTNjMlZ5SUQ5Y2JpQWdJQ0IwWVhKblpYUkZiR1Z0Wlc1MExtRmtaRVYyWlc1MFRHbHpkR1Z1WlhJb1pYWmxiblJPWVcxbExDQm9ZVzVrYkdWeUxDQm1ZV3h6WlNrZ09seHVJQ0FnSUhSaGNtZGxkRVZzWlcxbGJuUXVZWFIwWVdOb1JYWmxiblFvSjI5dUp5QXJJR1YyWlc1MFRtRnRaU3dnYUdGdVpHeGxjaWs3WEc1OU8xeHVYRzVMWlhsaWIyRnlaQzV3Y205MGIzUjVjR1V1WDNWdVltbHVaRVYyWlc1MElEMGdablZ1WTNScGIyNG9kR0Z5WjJWMFJXeGxiV1Z1ZEN3Z1pYWmxiblJPWVcxbExDQm9ZVzVrYkdWeUtTQjdYRzRnSUhKbGRIVnliaUIwYUdsekxsOXBjMDF2WkdWeWJrSnliM2R6WlhJZ1AxeHVJQ0FnSUhSaGNtZGxkRVZzWlcxbGJuUXVjbVZ0YjNabFJYWmxiblJNYVhOMFpXNWxjaWhsZG1WdWRFNWhiV1VzSUdoaGJtUnNaWElzSUdaaGJITmxLU0E2WEc0Z0lDQWdkR0Z5WjJWMFJXeGxiV1Z1ZEM1a1pYUmhZMmhGZG1WdWRDZ25iMjRuSUNzZ1pYWmxiblJPWVcxbExDQm9ZVzVrYkdWeUtUdGNibjA3WEc1Y2JrdGxlV0p2WVhKa0xuQnliM1J2ZEhsd1pTNWZaMlYwUjNKdmRYQmxaRXhwYzNSbGJtVnljeUE5SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0IyWVhJZ2JHbHpkR1Z1WlhKSGNtOTFjSE1nSUNBOUlGdGRPMXh1SUNCMllYSWdiR2x6ZEdWdVpYSkhjbTkxY0UxaGNDQTlJRnRkTzF4dVhHNGdJSFpoY2lCc2FYTjBaVzVsY25NZ1BTQjBhR2x6TGw5c2FYTjBaVzVsY25NN1hHNGdJR2xtSUNoMGFHbHpMbDlqZFhKeVpXNTBRMjl1ZEdWNGRDQWhQVDBnSjJkc2IySmhiQ2NwSUh0Y2JpQWdJQ0JzYVhOMFpXNWxjbk1nUFNCYlhTNWpiMjVqWVhRb2JHbHpkR1Z1WlhKekxDQjBhR2x6TGw5amIyNTBaWGgwY3k1bmJHOWlZV3dwTzF4dUlDQjlYRzVjYmlBZ2JHbHpkR1Z1WlhKekxuTnZjblFvWm5WdVkzUnBiMjRvWVN3Z1lpa2dlMXh1SUNBZ0lISmxkSFZ5YmlBb1lpNXJaWGxEYjIxaWJ5QS9JR0l1YTJWNVEyOXRZbTh1YTJWNVRtRnRaWE11YkdWdVozUm9JRG9nTUNrZ0xTQW9ZUzVyWlhsRGIyMWlieUEvSUdFdWEyVjVRMjl0WW04dWEyVjVUbUZ0WlhNdWJHVnVaM1JvSURvZ01DazdYRzRnSUgwcExtWnZja1ZoWTJnb1puVnVZM1JwYjI0b2JDa2dlMXh1SUNBZ0lIWmhjaUJ0WVhCSmJtUmxlQ0E5SUMweE8xeHVJQ0FnSUdadmNpQW9kbUZ5SUdrZ1BTQXdPeUJwSUR3Z2JHbHpkR1Z1WlhKSGNtOTFjRTFoY0M1c1pXNW5kR2c3SUdrZ0t6MGdNU2tnZTF4dUlDQWdJQ0FnYVdZZ0tHeHBjM1JsYm1WeVIzSnZkWEJOWVhCYmFWMGdQVDA5SUc1MWJHd2dKaVlnYkM1clpYbERiMjFpYnlBOVBUMGdiblZzYkNCOGZGeHVJQ0FnSUNBZ0lDQWdJR3hwYzNSbGJtVnlSM0p2ZFhCTllYQmJhVjBnSVQwOUlHNTFiR3dnSmlZZ2JHbHpkR1Z1WlhKSGNtOTFjRTFoY0Z0cFhTNXBjMFZ4ZFdGc0tHd3VhMlY1UTI5dFltOHBLU0I3WEc0Z0lDQWdJQ0FnSUcxaGNFbHVaR1Y0SUQwZ2FUdGNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNGdJQ0FnYVdZZ0tHMWhjRWx1WkdWNElEMDlQU0F0TVNrZ2UxeHVJQ0FnSUNBZ2JXRndTVzVrWlhnZ1BTQnNhWE4wWlc1bGNrZHliM1Z3VFdGd0xteGxibWQwYUR0Y2JpQWdJQ0FnSUd4cGMzUmxibVZ5UjNKdmRYQk5ZWEF1Y0hWemFDaHNMbXRsZVVOdmJXSnZLVHRjYmlBZ0lDQjlYRzRnSUNBZ2FXWWdLQ0ZzYVhOMFpXNWxja2R5YjNWd2MxdHRZWEJKYm1SbGVGMHBJSHRjYmlBZ0lDQWdJR3hwYzNSbGJtVnlSM0p2ZFhCelcyMWhjRWx1WkdWNFhTQTlJRnRkTzF4dUlDQWdJSDFjYmlBZ0lDQnNhWE4wWlc1bGNrZHliM1Z3YzF0dFlYQkpibVJsZUYwdWNIVnphQ2hzS1R0Y2JpQWdmU2s3WEc0Z0lISmxkSFZ5YmlCc2FYTjBaVzVsY2tkeWIzVndjenRjYm4wN1hHNWNibHh1ZG1GeUlGOU5RVkFnUFNCN1hHNGdJQ0FnT0RvZ0oySmhZMnR6Y0dGalpTY3NYRzRnSUNBZ09Ub2dKM1JoWWljc1hHNGdJQ0FnTVRNNklDZGxiblJsY2ljc1hHNGdJQ0FnTVRZNklDZHphR2xtZENjc1hHNGdJQ0FnTVRjNklDZGpkSEpzSnl4Y2JpQWdJQ0F4T0RvZ0oyRnNkQ2NzWEc0Z0lDQWdNakE2SUNkallYQnpiRzlqYXljc1hHNGdJQ0FnTWpjNklDZGxjMk1uTEZ4dUlDQWdJRE15T2lBbmMzQmhZMlVuTEZ4dUlDQWdJRE16T2lBbmNHRm5aWFZ3Snl4Y2JpQWdJQ0F6TkRvZ0ozQmhaMlZrYjNkdUp5eGNiaUFnSUNBek5Ub2dKMlZ1WkNjc1hHNGdJQ0FnTXpZNklDZG9iMjFsSnl4Y2JpQWdJQ0F6TnpvZ0oyeGxablFuTEZ4dUlDQWdJRE00T2lBbmRYQW5MRnh1SUNBZ0lETTVPaUFuY21sbmFIUW5MRnh1SUNBZ0lEUXdPaUFuWkc5M2JpY3NYRzRnSUNBZ05EVTZJQ2RwYm5NbkxGeHVJQ0FnSURRMk9pQW5aR1ZzSnl4Y2JpQWdJQ0E1TVRvZ0oyMWxkR0VuTEZ4dUlDQWdJRGt6T2lBbmJXVjBZU2NzWEc0Z0lDQWdNakkwT2lBbmJXVjBZU2RjYm4wN1hHNWNiaThxS2x4dUlDb2diV0Z3Y0dsdVp5Qm1iM0lnYzNCbFkybGhiQ0JqYUdGeVlXTjBaWEp6SUhOdklIUm9aWGtnWTJGdUlITjFjSEJ2Y25SY2JpQXFYRzRnS2lCMGFHbHpJR1JwWTNScGIyNWhjbmtnYVhNZ2IyNXNlU0IxYzJWa0lHbHVZMkZ6WlNCNWIzVWdkMkZ1ZENCMGJ5QmlhVzVrSUdGY2JpQXFJR3RsZVhWd0lHOXlJR3RsZVdSdmQyNGdaWFpsYm5RZ2RHOGdiMjVsSUc5bUlIUm9aWE5sSUd0bGVYTmNiaUFxWEc0Z0tpQkFkSGx3WlNCN1QySnFaV04wZlZ4dUlDb3ZYRzUyWVhJZ1gwdEZXVU5QUkVWZlRVRlFJRDBnZTF4dUlDQWdJREV3TmpvZ0p5b25MRnh1SUNBZ0lERXdOem9nSnlzbkxGeHVJQ0FnSURFd09Ub2dKeTBuTEZ4dUlDQWdJREV4TURvZ0p5NG5MRnh1SUNBZ0lERXhNU0E2SUNjdkp5eGNiaUFnSUNBeE9EWTZJQ2M3Snl4Y2JpQWdJQ0F4T0RjNklDYzlKeXhjYmlBZ0lDQXhPRGc2SUNjc0p5eGNiaUFnSUNBeE9EazZJQ2N0Snl4Y2JpQWdJQ0F4T1RBNklDY3VKeXhjYmlBZ0lDQXhPVEU2SUNjdkp5eGNiaUFnSUNBeE9USTZJQ2RnSnl4Y2JpQWdJQ0F5TVRrNklDZGJKeXhjYmlBZ0lDQXlNakE2SUNkY1hGeGNKeXhjYmlBZ0lDQXlNakU2SUNkZEp5eGNiaUFnSUNBeU1qSTZJQ2RjWENjblhHNTlPMXh1WEc0Z0lDQXZLaXBjYmlBZ0lDQWdLaUIwWVd0bGN5QjBhR1VnWlhabGJuUWdZVzVrSUhKbGRIVnlibk1nZEdobElHdGxlU0JqYUdGeVlXTjBaWEpjYmlBZ0lDQWdLbHh1SUNBZ0lDQXFJRUJ3WVhKaGJTQjdSWFpsYm5SOUlHVmNiaUFnSUNBZ0tpQkFjbVYwZFhKdUlIdHpkSEpwYm1kOVhHNGdJQ0FnSUNvdlhHNGdJQ0FnWm5WdVkzUnBiMjRnWDJOb1lYSmhZM1JsY2taeWIyMUZkbVZ1ZENobEtTQjdYRzVjYmlBZ0lDQWdJQ0FnTHk4Z1ptOXlJR3RsZVhCeVpYTnpJR1YyWlc1MGN5QjNaU0J6YUc5MWJHUWdjbVYwZFhKdUlIUm9aU0JqYUdGeVlXTjBaWElnWVhNZ2FYTmNiaUFnSUNBZ0lDQWdhV1lnS0dVdWRIbHdaU0E5UFNBbmEyVjVjSEpsYzNNbktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCMllYSWdZMmhoY21GamRHVnlJRDBnVTNSeWFXNW5MbVp5YjIxRGFHRnlRMjlrWlNobExuZG9hV05vS1R0Y2JseHVJQ0FnSUNBZ0lDQWdJQ0FnTHk4Z2FXWWdkR2hsSUhOb2FXWjBJR3RsZVNCcGN5QnViM1FnY0hKbGMzTmxaQ0IwYUdWdUlHbDBJR2x6SUhOaFptVWdkRzhnWVhOemRXMWxYRzRnSUNBZ0lDQWdJQ0FnSUNBdkx5QjBhR0YwSUhkbElIZGhiblFnZEdobElHTm9ZWEpoWTNSbGNpQjBieUJpWlNCc2IzZGxjbU5oYzJVdUlDQjBhR2x6SUcxbFlXNXpJR2xtWEc0Z0lDQWdJQ0FnSUNBZ0lDQXZMeUI1YjNVZ1lXTmphV1JsYm5SaGJHeDVJR2hoZG1VZ1kyRndjeUJzYjJOcklHOXVJSFJvWlc0Z2VXOTFjaUJyWlhrZ1ltbHVaR2x1WjNOY2JpQWdJQ0FnSUNBZ0lDQWdJQzh2SUhkcGJHd2dZMjl1ZEdsdWRXVWdkRzhnZDI5eWExeHVJQ0FnSUNBZ0lDQWdJQ0FnTHk5Y2JpQWdJQ0FnSUNBZ0lDQWdJQzh2SUhSb1pTQnZibXg1SUhOcFpHVWdaV1ptWldOMElIUm9ZWFFnYldsbmFIUWdibTkwSUdKbElHUmxjMmx5WldRZ2FYTWdhV1lnZVc5MVhHNGdJQ0FnSUNBZ0lDQWdJQ0F2THlCaWFXNWtJSE52YldWMGFHbHVaeUJzYVd0bElDZEJKeUJqWVhWelpTQjViM1VnZDJGdWRDQjBieUIwY21sbloyVnlJR0Z1WEc0Z0lDQWdJQ0FnSUNBZ0lDQXZMeUJsZG1WdWRDQjNhR1Z1SUdOaGNHbDBZV3dnUVNCcGN5QndjbVZ6YzJWa0lHTmhjSE1nYkc5amF5QjNhV3hzSUc1dklHeHZibWRsY2x4dUlDQWdJQ0FnSUNBZ0lDQWdMeThnZEhKcFoyZGxjaUIwYUdVZ1pYWmxiblF1SUNCemFHbG1kQ3RoSUhkcGJHd2dkR2h2ZFdkb0xseHVJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tDRmxMbk5vYVdaMFMyVjVLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTJoaGNtRmpkR1Z5SUQwZ1kyaGhjbUZqZEdWeUxuUnZURzkzWlhKRFlYTmxLQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCamFHRnlZV04wWlhJN1hHNGdJQ0FnSUNBZ0lIMWNibHh1SUNBZ0lDQWdJQ0F2THlCbWIzSWdibTl1SUd0bGVYQnlaWE56SUdWMlpXNTBjeUIwYUdVZ2MzQmxZMmxoYkNCdFlYQnpJR0Z5WlNCdVpXVmtaV1JjYmlBZ0lDQWdJQ0FnYVdZZ0tGOU5RVkJiWlM1M2FHbGphRjBwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmZUVUZRVzJVdWQyaHBZMmhkTzF4dUlDQWdJQ0FnSUNCOVhHNWNiaUFnSUNBZ0lDQWdhV1lnS0Y5TFJWbERUMFJGWDAxQlVGdGxMbmRvYVdOb1hTa2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUY5TFJWbERUMFJGWDAxQlVGdGxMbmRvYVdOb1hUdGNiaUFnSUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0FnSUM4dklHbG1JR2wwSUdseklHNXZkQ0JwYmlCMGFHVWdjM0JsWTJsaGJDQnRZWEJjYmx4dUlDQWdJQ0FnSUNBdkx5QjNhWFJvSUd0bGVXUnZkMjRnWVc1a0lHdGxlWFZ3SUdWMlpXNTBjeUIwYUdVZ1kyaGhjbUZqZEdWeUlITmxaVzF6SUhSdklHRnNkMkY1YzF4dUlDQWdJQ0FnSUNBdkx5QmpiMjFsSUdsdUlHRnpJR0Z1SUhWd2NHVnlZMkZ6WlNCamFHRnlZV04wWlhJZ2QyaGxkR2hsY2lCNWIzVWdZWEpsSUhCeVpYTnphVzVuSUhOb2FXWjBYRzRnSUNBZ0lDQWdJQzh2SUc5eUlHNXZkQzRnSUhkbElITm9iM1ZzWkNCdFlXdGxJSE4xY21VZ2FYUWdhWE1nWVd4M1lYbHpJR3h2ZDJWeVkyRnpaU0JtYjNJZ1kyOXRjR0Z5YVhOdmJuTmNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlGTjBjbWx1Wnk1bWNtOXRRMmhoY2tOdlpHVW9aUzUzYUdsamFDa3VkRzlNYjNkbGNrTmhjMlVvS1R0Y2JpQWdJQ0I5WEc1Y2JrdGxlV0p2WVhKa0xuQnliM1J2ZEhsd1pTNWZZWEJ3YkhsQ2FXNWthVzVuY3lBOUlHWjFibU4wYVc5dUtHVjJaVzUwS1NCN1hHNGdJQ0FnWTI5dWMyOXNaUzVzYjJjb1hDSmZZWEJ3YkhsQ2FXNWthVzVuYzF3aUxDQmxkbVZ1ZENsY2JpQWdJQ0JwWmlBb2RIbHdaVzltSUdWMlpXNTBMbmRvYVdOb0lDRTlQU0FuYm5WdFltVnlKeWtnZTF4dUlDQWdJQ0FnSUNCbGRtVnVkQzUzYUdsamFDQTlJR1YyWlc1MExtdGxlVU52WkdVN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnZG1GeUlHTm9ZWEpoWTNSbGNpQTlJRjlqYUdGeVlXTjBaWEpHY205dFJYWmxiblFvWlhabGJuUXBPMXh1SUNCMllYSWdjSEpsZG1WdWRGSmxjR1ZoZENBOUlHWmhiSE5sTzF4dVhHNGdJR1YyWlc1MElIeDhJQ2hsZG1WdWRDQTlJSHQ5S1R0Y2JpQWdaWFpsYm5RdWNISmxkbVZ1ZEZKbGNHVmhkQ0E5SUdaMWJtTjBhVzl1S0NrZ2V5QndjbVYyWlc1MFVtVndaV0YwSUQwZ2RISjFaVHNnZlR0Y2JpQWdaWFpsYm5RdWNISmxjM05sWkV0bGVYTWdJQ0E5SUhSb2FYTXVYMnh2WTJGc1pTNXdjbVZ6YzJWa1MyVjVjeTV6YkdsalpTZ3dLVHRjYmx4dUlDQjJZWElnY0hKbGMzTmxaRXRsZVhNZ0lDQWdQU0IwYUdsekxsOXNiMk5oYkdVdWNISmxjM05sWkV0bGVYTXVjMnhwWTJVb01DazdYRzRnSUhaaGNpQnNhWE4wWlc1bGNrZHliM1Z3Y3lBOUlIUm9hWE11WDJkbGRFZHliM1Z3WldSTWFYTjBaVzVsY25Nb0tUdGNibHh1WEc0Z0lHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2diR2x6ZEdWdVpYSkhjbTkxY0hNdWJHVnVaM1JvT3lCcElDczlJREVwSUh0Y2JpQWdJQ0IyWVhJZ2JHbHpkR1Z1WlhKeklEMGdiR2x6ZEdWdVpYSkhjbTkxY0hOYmFWMDdYRzRnSUNBZ2RtRnlJR3RsZVVOdmJXSnZJQ0E5SUd4cGMzUmxibVZ5YzFzd1hTNXJaWGxEYjIxaWJ6dGNibHh1SUNBZ0lHbG1JQ2hyWlhsRGIyMWlieUE5UFQwZ2JuVnNiQ0I4ZkNCclpYbERiMjFpYnk1amFHVmpheWh3Y21WemMyVmtTMlY1Y3lrcElIdGNiaUFnSUNBZ0lHWnZjaUFvZG1GeUlHb2dQU0F3T3lCcUlEd2diR2x6ZEdWdVpYSnpMbXhsYm1kMGFEc2dhaUFyUFNBeEtTQjdYRzRnSUNBZ0lDQWdJSFpoY2lCc2FYTjBaVzVsY2lBOUlHeHBjM1JsYm1WeWMxdHFYVHRjYmx4dUlDQWdJQ0FnSUNCcFppQW9hMlY1UTI5dFltOGdQVDA5SUc1MWJHd3BJSHRjYmlBZ0lDQWdJQ0FnSUNCc2FYTjBaVzVsY2lBOUlIdGNiaUFnSUNBZ0lDQWdJQ0FnSUd0bGVVTnZiV0p2SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdPaUJ1WlhjZ1MyVjVRMjl0WW04b2NISmxjM05sWkV0bGVYTXVhbTlwYmlnbkt5Y3BLU3hjYmlBZ0lDQWdJQ0FnSUNBZ0lIQnlaWE56U0dGdVpHeGxjaUFnSUNBZ0lDQWdJQ0FnT2lCc2FYTjBaVzVsY2k1d2NtVnpjMGhoYm1Sc1pYSXNYRzRnSUNBZ0lDQWdJQ0FnSUNCeVpXeGxZWE5sU0dGdVpHeGxjaUFnSUNBZ0lDQWdJRG9nYkdsemRHVnVaWEl1Y21Wc1pXRnpaVWhoYm1Sc1pYSXNYRzRnSUNBZ0lDQWdJQ0FnSUNCd2NtVjJaVzUwVW1Wd1pXRjBJQ0FnSUNBZ0lDQWdJRG9nYkdsemRHVnVaWEl1Y0hKbGRtVnVkRkpsY0dWaGRDeGNiaUFnSUNBZ0lDQWdJQ0FnSUhCeVpYWmxiblJTWlhCbFlYUkNlVVJsWm1GMWJIUWdPaUJzYVhOMFpXNWxjaTV3Y21WMlpXNTBVbVZ3WldGMFFubEVaV1poZFd4MFhHNGdJQ0FnSUNBZ0lDQWdmVHRjYmlBZ0lDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNBZ0lHbG1JQ2hzYVhOMFpXNWxjaTV3Y21WemMwaGhibVJzWlhJZ0ppWWdJV3hwYzNSbGJtVnlMbkJ5WlhabGJuUlNaWEJsWVhRcElIdGNiaUFnSUNBZ0lDQWdJQ0JzYVhOMFpXNWxjaTV3Y21WemMwaGhibVJzWlhJdVkyRnNiQ2gwYUdsekxDQmxkbVZ1ZENrN1hHNGdJQ0FnSUNBZ0lDQWdhV1lnS0hCeVpYWmxiblJTWlhCbFlYUXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHeHBjM1JsYm1WeUxuQnlaWFpsYm5SU1pYQmxZWFFnUFNCd2NtVjJaVzUwVW1Wd1pXRjBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2NISmxkbVZ1ZEZKbGNHVmhkQ0FnSUNBZ0lDQWdJQ0E5SUdaaGJITmxPMXh1SUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2ZWeHVYRzRnSUNBZ0lDQWdJR2xtSUNoc2FYTjBaVzVsY2k1eVpXeGxZWE5sU0dGdVpHeGxjaUFtSmlCMGFHbHpMbDloY0hCc2FXVmtUR2x6ZEdWdVpYSnpMbWx1WkdWNFQyWW9iR2x6ZEdWdVpYSXBJRDA5UFNBdE1Ta2dlMXh1SUNBZ0lDQWdJQ0FnSUhSb2FYTXVYMkZ3Y0d4cFpXUk1hWE4wWlc1bGNuTXVjSFZ6YUNoc2FYTjBaVzVsY2lrN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMWNibHh1SUNBZ0lDQWdhV1lnS0d0bGVVTnZiV0p2S1NCN1hHNGdJQ0FnSUNBZ0lHWnZjaUFvZG1GeUlHb2dQU0F3T3lCcUlEd2dhMlY1UTI5dFltOHVhMlY1VG1GdFpYTXViR1Z1WjNSb095QnFJQ3M5SURFcElIdGNiaUFnSUNBZ0lDQWdJQ0IyWVhJZ2FXNWtaWGdnUFNCd2NtVnpjMlZrUzJWNWN5NXBibVJsZUU5bUtHdGxlVU52YldKdkxtdGxlVTVoYldWelcycGRLVHRjYmlBZ0lDQWdJQ0FnSUNCcFppQW9hVzVrWlhnZ0lUMDlJQzB4S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0J3Y21WemMyVmtTMlY1Y3k1emNHeHBZMlVvYVc1a1pYZ3NJREVwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdhaUF0UFNBeE8xeHVJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnZlZ4dUlDQWdJSDFjYmlBZ2ZWeHVmVHRjYmx4dVMyVjVZbTloY21RdWNISnZkRzkwZVhCbExsOWpiR1ZoY2tKcGJtUnBibWR6SUQwZ1puVnVZM1JwYjI0b1pYWmxiblFwSUh0Y2JpQWdaWFpsYm5RZ2ZId2dLR1YyWlc1MElEMGdlMzBwTzF4dVhHNGdJR1p2Y2lBb2RtRnlJR2tnUFNBd095QnBJRHdnZEdocGN5NWZZWEJ3YkdsbFpFeHBjM1JsYm1WeWN5NXNaVzVuZEdnN0lHa2dLejBnTVNrZ2UxeHVJQ0FnSUhaaGNpQnNhWE4wWlc1bGNpQTlJSFJvYVhNdVgyRndjR3hwWldSTWFYTjBaVzVsY25OYmFWMDdYRzRnSUNBZ2RtRnlJR3RsZVVOdmJXSnZJRDBnYkdsemRHVnVaWEl1YTJWNVEyOXRZbTg3WEc0Z0lDQWdhV1lnS0d0bGVVTnZiV0p2SUQwOVBTQnVkV3hzSUh4OElDRnJaWGxEYjIxaWJ5NWphR1ZqYXloMGFHbHpMbDlzYjJOaGJHVXVjSEpsYzNObFpFdGxlWE1wS1NCN1hHNGdJQ0FnSUNCcFppQW9kR2hwY3k1ZlkyRnNiR1Z5U0dGdVpHeGxjaUFoUFQwZ2JHbHpkR1Z1WlhJdWNtVnNaV0Z6WlVoaGJtUnNaWElwSUh0Y2JpQWdJQ0FnSUNBZ2RtRnlJRzlzWkVOaGJHeGxjaUE5SUhSb2FYTXVYMk5oYkd4bGNraGhibVJzWlhJN1hHNGdJQ0FnSUNBZ0lIUm9hWE11WDJOaGJHeGxja2hoYm1Sc1pYSWdQU0JzYVhOMFpXNWxjaTV5Wld4bFlYTmxTR0Z1Wkd4bGNqdGNiaUFnSUNBZ0lDQWdiR2x6ZEdWdVpYSXVjSEpsZG1WdWRGSmxjR1ZoZENBOUlHeHBjM1JsYm1WeUxuQnlaWFpsYm5SU1pYQmxZWFJDZVVSbFptRjFiSFE3WEc0Z0lDQWdJQ0FnSUd4cGMzUmxibVZ5TG5KbGJHVmhjMlZJWVc1a2JHVnlMbU5oYkd3b2RHaHBjeXdnWlhabGJuUXBPMXh1SUNBZ0lDQWdJQ0IwYUdsekxsOWpZV3hzWlhKSVlXNWtiR1Z5SUQwZ2IyeGtRMkZzYkdWeU8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2RHaHBjeTVmWVhCd2JHbGxaRXhwYzNSbGJtVnljeTV6Y0d4cFkyVW9hU3dnTVNrN1hHNGdJQ0FnSUNCcElDMDlJREU3WEc0Z0lDQWdmVnh1SUNCOVhHNTlPMXh1WEc1TFpYbGliMkZ5WkM1d2NtOTBiM1I1Y0dVdVgyaGhibVJzWlVOdmJXMWhibVJDZFdjZ1BTQm1kVzVqZEdsdmJpaGxkbVZ1ZEN3Z2NHeGhkR1p2Y20wcElIdGNiaUFnTHk4Z1QyNGdUV0ZqSUhkb1pXNGdkR2hsSUdOdmJXMWhibVFnYTJWNUlHbHpJR3RsY0hRZ2NISmxjM05sWkN3Z2EyVjVkWEFnYVhNZ2JtOTBJSFJ5YVdkblpYSmxaQ0JtYjNJZ1lXNTVJRzkwYUdWeUlHdGxlUzVjYmlBZ0x5OGdTVzRnZEdocGN5QmpZWE5sSUdadmNtTmxJR0VnYTJWNWRYQWdabTl5SUc1dmJpMXRiMlJwWm1sbGNpQnJaWGx6SUdScGNtVmpkR3g1SUdGbWRHVnlJSFJvWlNCclpYbHdjbVZ6Y3k1Y2JpQWdkbUZ5SUcxdlpHbG1hV1Z5UzJWNWN5QTlJRnRjSW5Ob2FXWjBYQ0lzSUZ3aVkzUnliRndpTENCY0ltRnNkRndpTENCY0ltTmhjSE5zYjJOclhDSXNJRndpZEdGaVhDSXNJRndpWTI5dGJXRnVaRndpWFR0Y2JpQWdhV1lnS0hCc1lYUm1iM0p0TG0xaGRHTm9LRndpVFdGalhDSXBJQ1ltSUhSb2FYTXVYMnh2WTJGc1pTNXdjbVZ6YzJWa1MyVjVjeTVwYm1Oc2RXUmxjeWhjSW1OdmJXMWhibVJjSWlrZ0ppWmNiaUFnSUNBZ0lDRnRiMlJwWm1sbGNrdGxlWE11YVc1amJIVmtaWE1vZEdocGN5NWZiRzlqWVd4bExtZGxkRXRsZVU1aGJXVnpLR1YyWlc1MExtdGxlVU52WkdVcFd6QmRLU2tnZTF4dUlDQWdJSFJvYVhNdVgzUmhjbWRsZEV0bGVWVndRbWx1WkdsdVp5aGxkbVZ1ZENrN1hHNGdJSDFjYm4wN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdTMlY1WW05aGNtUTdYRzRpWFgwPSIsIlxudmFyIEtleUNvbWJvID0gcmVxdWlyZSgnLi9rZXktY29tYm8nKTtcblxuXG5mdW5jdGlvbiBMb2NhbGUobmFtZSkge1xuICB0aGlzLmxvY2FsZU5hbWUgICAgID0gbmFtZTtcbiAgdGhpcy5wcmVzc2VkS2V5cyAgICA9IFtdO1xuICB0aGlzLl9hcHBsaWVkTWFjcm9zID0gW107XG4gIHRoaXMuX2tleU1hcCAgICAgICAgPSB7fTtcbiAgdGhpcy5fa2lsbEtleUNvZGVzICA9IFtdO1xuICB0aGlzLl9tYWNyb3MgICAgICAgID0gW107XG59XG5cbkxvY2FsZS5wcm90b3R5cGUuYmluZEtleUNvZGUgPSBmdW5jdGlvbihrZXlDb2RlLCBrZXlOYW1lcykge1xuICBpZiAodHlwZW9mIGtleU5hbWVzID09PSAnc3RyaW5nJykge1xuICAgIGtleU5hbWVzID0gW2tleU5hbWVzXTtcbiAgfVxuXG4gIHRoaXMuX2tleU1hcFtrZXlDb2RlXSA9IGtleU5hbWVzO1xufTtcblxuTG9jYWxlLnByb3RvdHlwZS5iaW5kTWFjcm8gPSBmdW5jdGlvbihrZXlDb21ib1N0ciwga2V5TmFtZXMpIHtcbiAgaWYgKHR5cGVvZiBrZXlOYW1lcyA9PT0gJ3N0cmluZycpIHtcbiAgICBrZXlOYW1lcyA9IFsga2V5TmFtZXMgXTtcbiAgfVxuXG4gIHZhciBoYW5kbGVyID0gbnVsbDtcbiAgaWYgKHR5cGVvZiBrZXlOYW1lcyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGhhbmRsZXIgPSBrZXlOYW1lcztcbiAgICBrZXlOYW1lcyA9IG51bGw7XG4gIH1cblxuICB2YXIgbWFjcm8gPSB7XG4gICAga2V5Q29tYm8gOiBuZXcgS2V5Q29tYm8oa2V5Q29tYm9TdHIpLFxuICAgIGtleU5hbWVzIDoga2V5TmFtZXMsXG4gICAgaGFuZGxlciAgOiBoYW5kbGVyXG4gIH07XG5cbiAgdGhpcy5fbWFjcm9zLnB1c2gobWFjcm8pO1xufTtcblxuTG9jYWxlLnByb3RvdHlwZS5nZXRLZXlDb2RlcyA9IGZ1bmN0aW9uKGtleU5hbWUpIHtcbiAgdmFyIGtleUNvZGVzID0gW107XG4gIGZvciAodmFyIGtleUNvZGUgaW4gdGhpcy5fa2V5TWFwKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5fa2V5TWFwW2tleUNvZGVdLmluZGV4T2Yoa2V5TmFtZSk7XG4gICAgaWYgKGluZGV4ID4gLTEpIHsga2V5Q29kZXMucHVzaChrZXlDb2RlfDApOyB9XG4gIH1cbiAgcmV0dXJuIGtleUNvZGVzO1xufTtcblxuTG9jYWxlLnByb3RvdHlwZS5nZXRLZXlOYW1lcyA9IGZ1bmN0aW9uKGtleUNvZGUpIHtcbiAgcmV0dXJuIHRoaXMuX2tleU1hcFtrZXlDb2RlXSB8fCBbXTtcbn07XG5cbkxvY2FsZS5wcm90b3R5cGUuc2V0S2lsbEtleSA9IGZ1bmN0aW9uKGtleUNvZGUpIHtcbiAgaWYgKHR5cGVvZiBrZXlDb2RlID09PSAnc3RyaW5nJykge1xuICAgIHZhciBrZXlDb2RlcyA9IHRoaXMuZ2V0S2V5Q29kZXMoa2V5Q29kZSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlDb2Rlcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgdGhpcy5zZXRLaWxsS2V5KGtleUNvZGVzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5fa2lsbEtleUNvZGVzLnB1c2goa2V5Q29kZSk7XG59O1xuXG5Mb2NhbGUucHJvdG90eXBlLnByZXNzS2V5ID0gZnVuY3Rpb24oa2V5Q29kZSkge1xuICBpZiAodHlwZW9mIGtleUNvZGUgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFyIGtleUNvZGVzID0gdGhpcy5nZXRLZXlDb2RlcyhrZXlDb2RlKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleUNvZGVzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICB0aGlzLnByZXNzS2V5KGtleUNvZGVzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGtleU5hbWVzID0gdGhpcy5nZXRLZXlOYW1lcyhrZXlDb2RlKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlOYW1lcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGlmICh0aGlzLnByZXNzZWRLZXlzLmluZGV4T2Yoa2V5TmFtZXNbaV0pID09PSAtMSkge1xuICAgICAgdGhpcy5wcmVzc2VkS2V5cy5wdXNoKGtleU5hbWVzW2ldKTtcbiAgICB9XG4gIH1cblxuICB0aGlzLl9hcHBseU1hY3JvcygpO1xufTtcblxuTG9jYWxlLnByb3RvdHlwZS5yZWxlYXNlS2V5ID0gZnVuY3Rpb24oa2V5Q29kZSkge1xuICBpZiAodHlwZW9mIGtleUNvZGUgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFyIGtleUNvZGVzID0gdGhpcy5nZXRLZXlDb2RlcyhrZXlDb2RlKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleUNvZGVzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICB0aGlzLnJlbGVhc2VLZXkoa2V5Q29kZXNbaV0pO1xuICAgIH1cbiAgfVxuXG4gIGVsc2Uge1xuICAgIHZhciBrZXlOYW1lcyAgICAgICAgID0gdGhpcy5nZXRLZXlOYW1lcyhrZXlDb2RlKTtcbiAgICB2YXIga2lsbEtleUNvZGVJbmRleCA9IHRoaXMuX2tpbGxLZXlDb2Rlcy5pbmRleE9mKGtleUNvZGUpO1xuICAgIFxuICAgIGlmIChraWxsS2V5Q29kZUluZGV4ID4gLTEpIHtcbiAgICAgIHRoaXMucHJlc3NlZEtleXMubGVuZ3RoID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlOYW1lcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICB2YXIgaW5kZXggPSB0aGlzLnByZXNzZWRLZXlzLmluZGV4T2Yoa2V5TmFtZXNbaV0pO1xuICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICAgIHRoaXMucHJlc3NlZEtleXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2NsZWFyTWFjcm9zKCk7XG4gIH1cbn07XG5cbkxvY2FsZS5wcm90b3R5cGUuX2FwcGx5TWFjcm9zID0gZnVuY3Rpb24oKSB7XG4gIHZhciBtYWNyb3MgPSB0aGlzLl9tYWNyb3Muc2xpY2UoMCk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbWFjcm9zLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgdmFyIG1hY3JvID0gbWFjcm9zW2ldO1xuICAgIGlmIChtYWNyby5rZXlDb21iby5jaGVjayh0aGlzLnByZXNzZWRLZXlzKSkge1xuICAgICAgaWYgKG1hY3JvLmhhbmRsZXIpIHtcbiAgICAgICAgbWFjcm8ua2V5TmFtZXMgPSBtYWNyby5oYW5kbGVyKHRoaXMucHJlc3NlZEtleXMpO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBtYWNyby5rZXlOYW1lcy5sZW5ndGg7IGogKz0gMSkge1xuICAgICAgICBpZiAodGhpcy5wcmVzc2VkS2V5cy5pbmRleE9mKG1hY3JvLmtleU5hbWVzW2pdKSA9PT0gLTEpIHtcbiAgICAgICAgICB0aGlzLnByZXNzZWRLZXlzLnB1c2gobWFjcm8ua2V5TmFtZXNbal0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLl9hcHBsaWVkTWFjcm9zLnB1c2gobWFjcm8pO1xuICAgIH1cbiAgfVxufTtcblxuTG9jYWxlLnByb3RvdHlwZS5fY2xlYXJNYWNyb3MgPSBmdW5jdGlvbigpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9hcHBsaWVkTWFjcm9zLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgdmFyIG1hY3JvID0gdGhpcy5fYXBwbGllZE1hY3Jvc1tpXTtcbiAgICBpZiAoIW1hY3JvLmtleUNvbWJvLmNoZWNrKHRoaXMucHJlc3NlZEtleXMpKSB7XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1hY3JvLmtleU5hbWVzLmxlbmd0aDsgaiArPSAxKSB7XG4gICAgICAgIHZhciBpbmRleCA9IHRoaXMucHJlc3NlZEtleXMuaW5kZXhPZihtYWNyby5rZXlOYW1lc1tqXSk7XG4gICAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgICAgdGhpcy5wcmVzc2VkS2V5cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAobWFjcm8uaGFuZGxlcikge1xuICAgICAgICBtYWNyby5rZXlOYW1lcyA9IG51bGw7XG4gICAgICB9XG4gICAgICB0aGlzLl9hcHBsaWVkTWFjcm9zLnNwbGljZShpLCAxKTtcbiAgICAgIGkgLT0gMTtcbiAgICB9XG4gIH1cbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBMb2NhbGU7XG4iLCJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24obG9jYWxlLCBwbGF0Zm9ybSwgdXNlckFnZW50KSB7XG5cbiAgLy8gZ2VuZXJhbFxuICBsb2NhbGUuYmluZEtleUNvZGUoMywgICBbJ2NhbmNlbCddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDgsICAgWydiYWNrc3BhY2UnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSg5LCAgIFsndGFiJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTIsICBbJ2NsZWFyJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTMsICBbJ2VudGVyJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTYsICBbJ3NoaWZ0J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTcsICBbJ2N0cmwnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxOCwgIFsnYWx0JywgJ21lbnUnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxOSwgIFsncGF1c2UnLCAnYnJlYWsnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgyMCwgIFsnY2Fwc2xvY2snXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgyNywgIFsnZXNjYXBlJywgJ2VzYyddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDMyLCAgWydzcGFjZScsICdzcGFjZWJhciddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDMzLCAgWydwYWdldXAnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgzNCwgIFsncGFnZWRvd24nXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgzNSwgIFsnZW5kJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMzYsICBbJ2hvbWUnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgzNywgIFsnbGVmdCddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDM4LCAgWyd1cCddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDM5LCAgWydyaWdodCddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDQwLCAgWydkb3duJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoNDEsICBbJ3NlbGVjdCddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDQyLCAgWydwcmludHNjcmVlbiddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDQzLCAgWydleGVjdXRlJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoNDQsICBbJ3NuYXBzaG90J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoNDUsICBbJ2luc2VydCcsICdpbnMnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSg0NiwgIFsnZGVsZXRlJywgJ2RlbCddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDQ3LCAgWydoZWxwJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTQ1LCBbJ3Njcm9sbGxvY2snLCAnc2Nyb2xsJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTg4LCBbJ2NvbW1hJywgJywnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxOTAsIFsncGVyaW9kJywgJy4nXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxOTEsIFsnc2xhc2gnLCAnZm9yd2FyZHNsYXNoJywgJy8nXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxOTIsIFsnZ3JhdmVhY2NlbnQnLCAnYCddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDIxOSwgWydvcGVuYnJhY2tldCcsICdbJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMjIwLCBbJ2JhY2tzbGFzaCcsICdcXFxcJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMjIxLCBbJ2Nsb3NlYnJhY2tldCcsICddJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMjIyLCBbJ2Fwb3N0cm9waGUnLCAnXFwnJ10pO1xuXG4gIC8vIDAtOVxuICBsb2NhbGUuYmluZEtleUNvZGUoNDgsIFsnemVybycsICcwJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoNDksIFsnb25lJywgJzEnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSg1MCwgWyd0d28nLCAnMiddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDUxLCBbJ3RocmVlJywgJzMnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSg1MiwgWydmb3VyJywgJzQnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSg1MywgWydmaXZlJywgJzUnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSg1NCwgWydzaXgnLCAnNiddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDU1LCBbJ3NldmVuJywgJzcnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSg1NiwgWydlaWdodCcsICc4J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoNTcsIFsnbmluZScsICc5J10pO1xuXG4gIC8vIG51bXBhZFxuICBsb2NhbGUuYmluZEtleUNvZGUoOTYsIFsnbnVtemVybycsICdudW0wJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoOTcsIFsnbnVtb25lJywgJ251bTEnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSg5OCwgWydudW10d28nLCAnbnVtMiddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDk5LCBbJ251bXRocmVlJywgJ251bTMnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxMDAsIFsnbnVtZm91cicsICdudW00J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTAxLCBbJ251bWZpdmUnLCAnbnVtNSddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDEwMiwgWydudW1zaXgnLCAnbnVtNiddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDEwMywgWydudW1zZXZlbicsICdudW03J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTA0LCBbJ251bWVpZ2h0JywgJ251bTgnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxMDUsIFsnbnVtbmluZScsICdudW05J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTA2LCBbJ251bW11bHRpcGx5JywgJ251bSonXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxMDcsIFsnbnVtYWRkJywgJ251bSsnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxMDgsIFsnbnVtZW50ZXInXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxMDksIFsnbnVtc3VidHJhY3QnLCAnbnVtLSddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDExMCwgWydudW1kZWNpbWFsJywgJ251bS4nXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxMTEsIFsnbnVtZGl2aWRlJywgJ251bS8nXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxNDQsIFsnbnVtbG9jaycsICdudW0nXSk7XG5cbiAgLy8gZnVuY3Rpb24ga2V5c1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTEyLCBbJ2YxJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTEzLCBbJ2YyJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTE0LCBbJ2YzJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTE1LCBbJ2Y0J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTE2LCBbJ2Y1J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTE3LCBbJ2Y2J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTE4LCBbJ2Y3J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTE5LCBbJ2Y4J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTIwLCBbJ2Y5J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTIxLCBbJ2YxMCddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDEyMiwgWydmMTEnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxMjMsIFsnZjEyJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTI0LCBbJ2YxMyddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDEyNSwgWydmMTQnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxMjYsIFsnZjE1J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTI3LCBbJ2YxNiddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDEyOCwgWydmMTcnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxMjksIFsnZjE4J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTMwLCBbJ2YxOSddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDEzMSwgWydmMjAnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxMzIsIFsnZjIxJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoMTMzLCBbJ2YyMiddKTtcbiAgbG9jYWxlLmJpbmRLZXlDb2RlKDEzNCwgWydmMjMnXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZSgxMzUsIFsnZjI0J10pO1xuXG4gIC8vIHNlY29uZGFyeSBrZXkgc3ltYm9sc1xuICBsb2NhbGUuYmluZE1hY3JvKCdzaGlmdCArIGAnLCBbJ3RpbGRlJywgJ34nXSk7XG4gIGxvY2FsZS5iaW5kTWFjcm8oJ3NoaWZ0ICsgMScsIFsnZXhjbGFtYXRpb24nLCAnZXhjbGFtYXRpb25wb2ludCcsICchJ10pO1xuICBsb2NhbGUuYmluZE1hY3JvKCdzaGlmdCArIDInLCBbJ2F0JywgJ0AnXSk7XG4gIGxvY2FsZS5iaW5kTWFjcm8oJ3NoaWZ0ICsgMycsIFsnbnVtYmVyJywgJyMnXSk7XG4gIGxvY2FsZS5iaW5kTWFjcm8oJ3NoaWZ0ICsgNCcsIFsnZG9sbGFyJywgJ2RvbGxhcnMnLCAnZG9sbGFyc2lnbicsICckJ10pO1xuICBsb2NhbGUuYmluZE1hY3JvKCdzaGlmdCArIDUnLCBbJ3BlcmNlbnQnLCAnJSddKTtcbiAgbG9jYWxlLmJpbmRNYWNybygnc2hpZnQgKyA2JywgWydjYXJldCcsICdeJ10pO1xuICBsb2NhbGUuYmluZE1hY3JvKCdzaGlmdCArIDcnLCBbJ2FtcGVyc2FuZCcsICdhbmQnLCAnJiddKTtcbiAgbG9jYWxlLmJpbmRNYWNybygnc2hpZnQgKyA4JywgWydhc3RlcmlzaycsICcqJ10pO1xuICBsb2NhbGUuYmluZE1hY3JvKCdzaGlmdCArIDknLCBbJ29wZW5wYXJlbicsICcoJ10pO1xuICBsb2NhbGUuYmluZE1hY3JvKCdzaGlmdCArIDAnLCBbJ2Nsb3NlcGFyZW4nLCAnKSddKTtcbiAgbG9jYWxlLmJpbmRNYWNybygnc2hpZnQgKyAtJywgWyd1bmRlcnNjb3JlJywgJ18nXSk7XG4gIGxvY2FsZS5iaW5kTWFjcm8oJ3NoaWZ0ICsgPScsIFsncGx1cycsICcrJ10pO1xuICBsb2NhbGUuYmluZE1hY3JvKCdzaGlmdCArIFsnLCBbJ29wZW5jdXJseWJyYWNlJywgJ29wZW5jdXJseWJyYWNrZXQnLCAneyddKTtcbiAgbG9jYWxlLmJpbmRNYWNybygnc2hpZnQgKyBdJywgWydjbG9zZWN1cmx5YnJhY2UnLCAnY2xvc2VjdXJseWJyYWNrZXQnLCAnfSddKTtcbiAgbG9jYWxlLmJpbmRNYWNybygnc2hpZnQgKyBcXFxcJywgWyd2ZXJ0aWNhbGJhcicsICd8J10pO1xuICBsb2NhbGUuYmluZE1hY3JvKCdzaGlmdCArIDsnLCBbJ2NvbG9uJywgJzonXSk7XG4gIGxvY2FsZS5iaW5kTWFjcm8oJ3NoaWZ0ICsgXFwnJywgWydxdW90YXRpb25tYXJrJywgJ1xcJyddKTtcbiAgbG9jYWxlLmJpbmRNYWNybygnc2hpZnQgKyAhLCcsIFsnb3BlbmFuZ2xlYnJhY2tldCcsICc8J10pO1xuICBsb2NhbGUuYmluZE1hY3JvKCdzaGlmdCArIC4nLCBbJ2Nsb3NlYW5nbGVicmFja2V0JywgJz4nXSk7XG4gIGxvY2FsZS5iaW5kTWFjcm8oJ3NoaWZ0ICsgLycsIFsncXVlc3Rpb25tYXJrJywgJz8nXSk7XG4gIFxuICBpZiAocGxhdGZvcm0ubWF0Y2goJ01hYycpKSB7XG4gICAgbG9jYWxlLmJpbmRNYWNybygnY29tbWFuZCcsIFsnbW9kJywgJ21vZGlmaWVyJ10pO1xuICB9IGVsc2Uge1xuICAgIGxvY2FsZS5iaW5kTWFjcm8oJ2N0cmwnLCBbJ21vZCcsICdtb2RpZmllciddKTtcbiAgfVxuXG4gIC8vYS16IGFuZCBBLVpcbiAgZm9yICh2YXIga2V5Q29kZSA9IDY1OyBrZXlDb2RlIDw9IDkwOyBrZXlDb2RlICs9IDEpIHtcbiAgICB2YXIga2V5TmFtZSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoa2V5Q29kZSArIDMyKTtcbiAgICB2YXIgY2FwaXRhbEtleU5hbWUgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGtleUNvZGUpO1xuICBcdGxvY2FsZS5iaW5kS2V5Q29kZShrZXlDb2RlLCBrZXlOYW1lKTtcbiAgXHRsb2NhbGUuYmluZE1hY3JvKCdzaGlmdCArICcgKyBrZXlOYW1lLCBjYXBpdGFsS2V5TmFtZSk7XG4gIFx0bG9jYWxlLmJpbmRNYWNybygnY2Fwc2xvY2sgKyAnICsga2V5TmFtZSwgY2FwaXRhbEtleU5hbWUpO1xuICB9XG5cbiAgLy8gYnJvd3NlciBjYXZlYXRzXG4gIHZhciBzZW1pY29sb25LZXlDb2RlID0gdXNlckFnZW50Lm1hdGNoKCdGaXJlZm94JykgPyA1OSAgOiAxODY7XG4gIHZhciBkYXNoS2V5Q29kZSAgICAgID0gdXNlckFnZW50Lm1hdGNoKCdGaXJlZm94JykgPyAxNzMgOiAxODk7XG4gIHZhciBlcXVhbEtleUNvZGUgICAgID0gdXNlckFnZW50Lm1hdGNoKCdGaXJlZm94JykgPyA2MSAgOiAxODc7XG4gIHZhciBsZWZ0Q29tbWFuZEtleUNvZGU7XG4gIHZhciByaWdodENvbW1hbmRLZXlDb2RlO1xuICBpZiAocGxhdGZvcm0ubWF0Y2goJ01hYycpICYmICh1c2VyQWdlbnQubWF0Y2goJ1NhZmFyaScpIHx8IHVzZXJBZ2VudC5tYXRjaCgnQ2hyb21lJykpKSB7XG4gICAgbGVmdENvbW1hbmRLZXlDb2RlICA9IDkxO1xuICAgIHJpZ2h0Q29tbWFuZEtleUNvZGUgPSA5MztcbiAgfSBlbHNlIGlmKHBsYXRmb3JtLm1hdGNoKCdNYWMnKSAmJiB1c2VyQWdlbnQubWF0Y2goJ09wZXJhJykpIHtcbiAgICBsZWZ0Q29tbWFuZEtleUNvZGUgID0gMTc7XG4gICAgcmlnaHRDb21tYW5kS2V5Q29kZSA9IDE3O1xuICB9IGVsc2UgaWYocGxhdGZvcm0ubWF0Y2goJ01hYycpICYmIHVzZXJBZ2VudC5tYXRjaCgnRmlyZWZveCcpKSB7XG4gICAgbGVmdENvbW1hbmRLZXlDb2RlICA9IDIyNDtcbiAgICByaWdodENvbW1hbmRLZXlDb2RlID0gMjI0O1xuICB9XG4gIGxvY2FsZS5iaW5kS2V5Q29kZShzZW1pY29sb25LZXlDb2RlLCAgICBbJ3NlbWljb2xvbicsICc7J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUoZGFzaEtleUNvZGUsICAgICAgICAgWydkYXNoJywgJy0nXSk7XG4gIGxvY2FsZS5iaW5kS2V5Q29kZShlcXVhbEtleUNvZGUsICAgICAgICBbJ2VxdWFsJywgJ2VxdWFsc2lnbicsICc9J10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUobGVmdENvbW1hbmRLZXlDb2RlLCAgWydjb21tYW5kJywgJ3dpbmRvd3MnLCAnd2luJywgJ3N1cGVyJywgJ2xlZnRjb21tYW5kJywgJ2xlZnR3aW5kb3dzJywgJ2xlZnR3aW4nLCAnbGVmdHN1cGVyJ10pO1xuICBsb2NhbGUuYmluZEtleUNvZGUocmlnaHRDb21tYW5kS2V5Q29kZSwgWydjb21tYW5kJywgJ3dpbmRvd3MnLCAnd2luJywgJ3N1cGVyJywgJ3JpZ2h0Y29tbWFuZCcsICdyaWdodHdpbmRvd3MnLCAncmlnaHR3aW4nLCAncmlnaHRzdXBlciddKTtcblxuICAvLyBraWxsIGtleXNcbiAgbG9jYWxlLnNldEtpbGxLZXkoJ2NvbW1hbmQnKTtcbn07XG4iXX0=
