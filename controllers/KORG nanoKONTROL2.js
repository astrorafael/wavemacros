/*
    Controller: KORG nanoKONTROL2
    
    License: MIT

    Copyright 2022 Rafael González

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/


// ==================
// Controller version
// ==================

const VERSION = "1.1.0";

// ===================
// DEBUGGING UTILITIES
// ===================

const DEBUG_MIDI_MSG   = 0x01; // Log MIDI I/O
const DEBUG_MAIN       = 0x02; // Log Main Controller messages
const DEBUG_CHAN_STRIP = 0x04; // Log Channel Strip Controller messages
const DEBUG_FADER_BANK = 0x08; // Log Fader Bank & Loop Controller messages
const DEBUG_MARKERS    = 0x10; // Log Markers Controller messages
const DEBUG_TRANSPORT  = 0x20  // Log Transport Controller messages

const DEBUG_LEVEL      = 0x04; // Current debug level

function debugFactory(level, mask) {
  return function (msg) { if (level & mask) logMsg(msg); };
}

// ====================================
// HUMAN INTERFACE ELEMENTS DEFINITIONS
// ====================================

// These appear as the first byte in the MIDI message
const SLIDER  = 0xe0;
const BUTTON  = 0x90;
const KNOB    = 0xb0;


// =========================================================================================== //
//                                     CHANNEL STRIP CLASS                                     //
// =========================================================================================== //

function ChannelStripController(channel, parent)
{
    // Available buttons
    const ARM_REC_BUTTON = 0x00;
    const SOLO_BUTTON    = 0x08;
    const MUTE_BUTTON    = 0x10;

    this.arm           = false;
    this.solo          = false;
    this.mute          = false;
    this.soloFlashing  = false;
    this.soloIsolEnab = false;
    this.parent        = parent;
    this.channel       = channel; // Always from 0 to 7

    // Helper method
    this.debugMsg = debugFactory(DEBUG_LEVEL, DEBUG_CHAN_STRIP);

    this.debugMsg("Creating channel strip [" + channel + "]");

    // soloLit         = 1,    Track is explicitly soloed. 
    // soloFlashing    = 2,    Track is implicitly soloed. 
    // soloIsolate     = 4,    Track is explicitly solo isolated. 
    // muteLit         = 8,    Track is explicitly muted.
    // muteFlashing    = 16    Track is implicitly muted.
    this.onSoloMuteChanged = function (muteAndSoloLightState, isBright) {
        this.mute = ((muteAndSoloLightState & (8 | 16))    != 0 );
        this.solo = ((muteAndSoloLightState & (1 | 2)) != 0 );
        this.soloIsolEnab = ((muteAndSoloLightState & 4)  != 0);
        this.parent.lightUpButton(SOLO_BUTTON + this.channel, this.solo);
        this.parent.lightUpButton(MUTE_BUTTON + this.channel, this.mute);
    }

    this.soloFlash = function() {
        if (this.soloIsolEnab && ! this.solo) {
            this.soloFlashing = !this.soloFlashing;
            this.parent.lightUpButton(SOLO_BUTTON + this.channel, this.soloFlashing);
        } else {
            this.parent.lightUpButton(SOLO_BUTTON + this.channel, this.solo);
        }
    }

    this.onTrackRecordEnabled = function(isEnabled) { 
        this.arm = isEnabled;
        this.parent.lightUpButton(ARM_REC_BUTTON + this.channel, this.arm);
    }
    
    this.handleMessage = function (msg) {
        var element = msg[0] & 0xf0;
        var button  = msg[1] & 0xf8;
        var channel = msg[1] & 0x07;
        var value   = msg[2];
        var handled = false;
        if((element == BUTTON) && (channel == this.channel) && (value != 0)) {
            if (button == SOLO_BUTTON) {
                this.debugMsg("Pressed <SOLO> <0x" + SOLO_BUTTON.toString(16) + "> [" + channel + "]");
                this.solo = !this.solo;
                this.parent.lightUpButton(SOLO_BUTTON + channel, this.solo);
                toggleSolo (this.channel);         // Call Waveform API
                selectPluginInTrack(this.channel); // Call Waveform API
                handled = true;
            } else if (button == MUTE_BUTTON) {
                this.debugMsg("Pressed <MUTE> <0x" + MUTE_BUTTON.toString(16) + "> [" + channel + "]");
                this.mute = !this.mute;
                this.parent.lightUpButton(MUTE_BUTTON + channel, this.mute);
                toggleMute (this.channel);         // Call Waveform API
                selectPluginInTrack(this.channel); // Call Waveform API
                handled = true;
            } else if (button == ARM_REC_BUTTON) {
                this.debugMsg("Pressed <ARM REC> <0x" + ARM_REC_BUTTON.toString(16) + "> [" + channel + "]");
                this.arm = !this.arm;
                this.parent.lightUpButton(ARM_REC_BUTTON + channel, this.arm);
                toggleRecEnable (this.channel, false); // Call Waveform API
                selectPluginInTrack(this.channel);     // Call Waveform API
                handled = true;  
            }
        } else if ((element == SLIDER) && ((msg[0] & 0x07) == this.channel)) {
            this.debugMsg("Moving <Slider> [" + this.channel + "] => " + value);
            setFader (this.channel, value / 127, false); // Call Waveform API
            selectPluginInTrack(this.channel);           // Call Waveform API
            handled = true;
         } else if ((element == KNOB) && (channel == this.channel)) {
            var increment = value & 0x40 ? -(value & 0x3F) : (value & 0x3F);
            this.debugMsg("Turning <Knob> [" + channel + "] => " + increment);
            setPanPot (this.channel, increment/63, true); // Call Waveform API
            selectPluginInTrack(this.channel);            // Call Waveform API
            handled = true;
        }
        return handled;
    }
}

// =========================================================================================== //
//                             FADER BANK AND LOOP CONTROL CLASS                               //
// =========================================================================================== //

function FaderBankController(parent, N)
{

    // Available buttons
    const TRACK_LEFT_BUTTON  = 0x2e;
    const TRACK_RIGHT_BUTTON = 0x2f;
    const CYCLE_BUTTON       = 0x56;

    this.parent  = parent;
    this.N       = N;           // Number of fader channels
    this.loop    = false;

    // Helper method
    this.debugMsg = debugFactory(DEBUG_LEVEL, DEBUG_FADER_BANK);
    
    this.debugMsg("Creating Fader Banks & Loop controller");

    this.onLoopChanged = function (isLoopOn) {
        this.loop   = isLoopOn;
        this.parent.lightUpButton(CYCLE_BUTTON, isLoopOn);
    }

    this.onFaderBankChanged = function(newStartChannelNumber) {
        var modulus = newStartChannelNumber % this.N;
        this.debugMsg("onFaderBankChanged(" + newStartChannelNumber + "): modulus = " + modulus);
        if (modulus != 0) {
            this.debugMsg("onFaderBankChanged(" + newStartChannelNumber + "): lowering start track by " + -modulus);
            changeFaderBanks (-modulus);
        }
    }

    this.handleMessage = function (msg) {
        var element = msg[0] & 0xf0;
        var button  = msg[1]
        var value   = msg[2];
        var handled = false;
        if ((element == BUTTON) && (button == TRACK_LEFT_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed <TRACK LEFT> <0x" + TRACK_LEFT_BUTTON.toString(16) + ">");
            if (getFaderBankOffset() > 0) {
                this.debugMsg("changeFaderBanks(" + -this.N + ")");
                changeFaderBanks (-this.N); // call Tracktion API
            }
            handled = true;
        } else if ((element == BUTTON) && (button == TRACK_RIGHT_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed <TRACK RIGHT> <0x" + TRACK_RIGHT_BUTTON.toString(16) + ">");
            if ((getFaderBankOffset() % this.N) == 0) {
                this.debugMsg("changeFaderBanks(" + this.N + ")");
                changeFaderBanks (this.N); // call Tracktion API
            }
            handled = true;
        } else if ((element == BUTTON) && (button == CYCLE_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed <CYCLE> <0x" + CYCLE_BUTTON.toString(16) + ">");
            this.loop = !this.loop;
            this.parent.lightUpButton(CYCLE_BUTTON, this.loop);
            toggleLoop();  // call Tracktion API
            handled = true;
        }
        return handled;
    }
}

// =========================================================================================== //
//                                    MARKERS CONTROL CLASS                                    //
// =========================================================================================== //

function MarkersController(parent)
{

    // Available buttons
    const MARKER_SET_BUTTON  = 0x59;
    const MARKER_NEXT_BUTTON = 0x5a;
    const MARKER_PREV_BUTTON = 0x58;

    this.parent = parent;

    // Helper method
    this.debugMsg = debugFactory(DEBUG_LEVEL, DEBUG_MARKERS);
    
    this.debugMsg("Creating Markers controller");

    this.handleMessage = function (msg) {
        var element = msg[0] & 0xf0;
        var button  = msg[1]
        var value   = msg[2];
        var handled = false;
        if ((element == BUTTON) && (button == MARKER_PREV_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed <MARKER PREV> <0x" + MARKER_PREV_BUTTON.toString(16) + ">");
            gotoPreviousMarker(); // Call Tracktion API
            handled = true;
        } else if ((element == BUTTON) && (button == MARKER_NEXT_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed <MARKER NEXT> <0x" + MARKER_NEXT_BUTTON.toString(16) + ">");
            gotoNextMarker();     // Call Tracktion API
            handled = true;
        } else if ((element == BUTTON) && (button == MARKER_SET_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed <MARKER SET> <0x" + MARKER_SET_BUTTON.toString(16) + ">");
            createMarker();       // Call Tracktion API
            handled = true;
        }
        return handled;
    }
}

// =========================================================================================== //
//                                    TRANSPORT CONTROL CLASS                                  //
// =========================================================================================== //

function TransportControl(parent)
{

    // Available buttons
    const REWIND_BUTTON       = 0x5b;
    const FAST_FORWARD_BUTTON = 0x5c;
    const STOP_BUTTON         = 0x5d;
    const PLAY_BUTTON         = 0x5e;
    const RECORD_BUTTON       = 0x5f;

    this.parent = parent;

    // Helper method
    this.debugMsg = debugFactory(DEBUG_LEVEL, DEBUG_TRANSPORT);
    
    
    this.debugMsg("Creating Transport controller");

    // tells the device that playback has stopped or started, and it should turn its lights on accordingly.
    this.onPlayStateChanged = function(isPlaying) {  
        this.parent.lightUpButton(STOP_BUTTON, ! isPlaying);
        this.parent.lightUpButton(PLAY_BUTTON,  isPlaying);
    }

    this.onRecordStateChanged = function(isRecording) {
        this.parent.lightUpButton(RECORD_BUTTON, isRecording);
    }

    this.handleMessage = function (msg) {
        var element = msg[0] & 0xf0;
        var button  = msg[1]
        var value   = msg[2];
        var handled = false;
        if ((element == BUTTON) && (button == REWIND_BUTTON)) {
            this.debugMsg("Pressed <REW> <0x" + REWIND_BUTTON.toString(16) + ">");
            // gotoStart(); 
            rewind (value == 0x7f);
            this.parent.lightUpButton(REWIND_BUTTON, value == 0x7f);
            handled = true;
        } else if ((element == BUTTON) && (button == FAST_FORWARD_BUTTON)) {
            this.debugMsg("Pressed <FF> <0x" + FAST_FORWARD_BUTTON.toString(16) + ">");
            // gotoEnd();
            fastForward (value == 0x7f);
            this.parent.lightUpButton(FAST_FORWARD_BUTTON, value == 0x7f);
            handled = true;
        } else if ((element == BUTTON) && (button == STOP_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed <STOP> <0x" + STOP_BUTTON.toString(16) + ">");
            stop(); // Call Tracktion API
            handled = true;
        } else if ((element == BUTTON) && (button == PLAY_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed <PLAY> <0x" + PLAY_BUTTON.toString(16) + ">");
            play();         // Call Tracktion API
            handled = true;
        } else if ((element == BUTTON) && (button == RECORD_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed <RECORD> <0x" + RECORD_BUTTON.toString(16) + ">");
            record();
            handled = true;
        }
        return handled;
    }
}


// =========================================================================================== //
//                                     MAIN CONTROLLER CLASS                                   //
// =========================================================================================== //

function KORGnanoKONTROL2() {

    const FLASH_PERIOD                 = 500;                         // solo/mute button flicker in ms

    // Tracktion's Waveform variables: these must be filled out so the session knows your controller layout
    this.deviceDescription               = "KORG nanoKONTROL 2";        // device name
    this.needsMidiChannel                = true;                        // send midi controller to daw
    this.needsMidiBackChannel            = true;                        // send midi daw to controller
    this.midiChannelName                 = "nanoKONTROL2 SLIDER/KNOB";  // MIDI channel name
    this.midiBackChannelName             = "nanoKONTROL2 CTRL";         // MIDI channel name
    this.numberOfFaderChannels           = 8;                           // number physical faders      
    this.wantsClock                      = false;                       // device wants MIDI clock
    this.allowBankingOffEnd              = true;                        // allow surface to display blank channels
    this.pickUpMode                      = true;                        // set true for non motorized faders
    this.notes                           = "Set 'LED Mode' = 'External' using Korg Kontrol Editor to enable light up buttons";
    this.needsOSCSocket                  = false;                       // communicate via osc
    this.numCharactersForTrackNames      = 0;                           // characters of channel text
    this.numCharactersForAuxLabels       = 0;                           // characters of aux text
    this.numParameterControls            = 0;                           // number of labelled rotary dials that can control things like plugin parameters
    this.numCharactersForParameterLabels = 0;                           // characters for rotary dials
    this.numMarkers                      = 0;                           // number of markers that can be displayed
    this.numCharactersForMarkerLabels    = 0;                           // characters for markers
    this.wantsAuxBanks                   = false;                       // display auxes
    this.numAuxes                        = 0;                           // number of auxes that can be displayed
    this.followsTrackSelection           = false;                       // controller track follows UI selection
    
    // Private variables
    this.children                        = new Array();
    this.channelStrip                    = new Array();
    this.bankController                  = null;
    this.markersController               = null;
    this.transport                       = null;
   
   
    // Helper method
    this.debugMsg = debugFactory(DEBUG_LEVEL, DEBUG_MAIN);

     // Helper method
    this.debugMIDI = debugFactory(DEBUG_LEVEL, DEBUG_MIDI_MSG);
   

    // Helper method: Lights up a given button
    this.lightUpButton = function(buttonNum, on) {
        var value = on ? 0x7f : 0x00;
        var string = "[0x" + BUTTON.toString(16) + ", 0x" + buttonNum.toString(16) + ", 0x" + value.toString(16) + "]";
        this.debugMIDI("MIDI OUT ==> " + string);
        sendMidiToDevice ([BUTTON, buttonNum, value]);
    }

    // Called by Tracktion's Waveform once at startup. 
    this.initialise = function() {
        logMsg(this.deviceDescription + " Controller, version " + VERSION);
        logMsg("Working in Cubase DAW mode: <SET> + <REW>");
        this.bankController    = new FaderBankController(this, this.numberOfFaderChannels);
        this.markersController = new MarkersController(this);
        this.transport         = new TransportControl(this);
        this.children.push (this.bankController);
        this.children.push (this.markersController);
        this.children.push (this.transport);
        for (var i = 0; i < this.numberOfFaderChannels; i++) {
            var obj = new ChannelStripController(i, this)
            this.children.push (obj);
            this.channelStrip.push(obj);
        } 
        stopTimer ("flash");   // just in case there is one hanging around
        startTimer ("flash", FLASH_PERIOD);
  
    }

    // Called by Tracktion's Waveform at startup or any time the midi or osc ports change.
    // You may now be talking to a new physical device now, time to
    // initialise the hardware again
    this.initialiseDevice = function() {  
        this.debugMsg("Initializing " + this.deviceDescription);
        updateDeviceState(); // not sure what it does ....
    }

    // called by Tracktion's Waveform at shutdown
    this.shutDownDevice = function() { 
        this.debugMsg("Shutting down " + this.deviceDescription); 
        stopTimer ("flash");      
    }

    // called by Tracktion's Waveform
    this.onTimer = function(name) {
        this.debugMsg("onTimer(" + name + ")");
        for(var channel=0; channel<this.numberOfFaderChannels; channel++) {
            this.channelStrip[channel].soloFlash();
        }
    }

    // called by Tracktion's Waveform
    this.onLoopChanged = function(isLoopOn) { 
        this.debugMsg("onLoopChanged(" + isLoopOn + ")"); 
        this.bankController.onLoopChanged(isLoopOn);  
    }

    // called by Tracktion's Waveform
    this.onSoloMuteChanged = function(channel, muteAndSoloLightState, isBright) {
        this.debugMsg("onSoloMuteChanged(" + channel + "," + muteAndSoloLightState + "," + isBright +")");
        this.channelStrip[channel].onSoloMuteChanged(muteAndSoloLightState, isBright);
    }

    // called by Tracktion's Waveform
    this.onTrackRecordEnabled = function(channel, isEnabled) {
        this.debugMsg("onTrackRecordEnabled(" + channel + "," + isEnabled +")");
        this.channelStrip[channel].onTrackRecordEnabled(isEnabled);  
    }

    // called by Tracktion's Waveform
    this.onFaderBankChanged = function(newStartChannelNumber) {
        this.debugMsg("onFaderBankChanged(" + newStartChannelNumber + ")");
        this.bankController.onFaderBankChanged(newStartChannelNumber);
    }

    // called by Tracktion's Waveform
    this.onPlayStateChanged = function(isPlaying) { 
        this.debugMsg("onPlayStateChanged(" + isPlaying + ")");   
        this.transport.onPlayStateChanged(isPlaying);
    }

    // called by Tracktion's Waveform
    this.onRecordStateChanged = function(isRecording) {
        this.debugMsg("onRecordStateChanged(" + isRecording + ")");  
        this.transport.onRecordStateChanged(isRecording);
    }


    // Called when a midi message comes in from the controller. You must
    //  translate this and call methods in the session accordingly to
    // trigger whatever action the user is trying to do.
    this.onMidiReceivedFromDevice = function(msg) {
        var string = "MIDI IN  <== [0x" + msg[0].toString(16) + ", 0x" + msg[1].toString(16) + ", 0x" + msg[2].toString(16) + "]"
        this.debugMIDI(string);
        var handled = false;
        for(var i=0; i < this.children.length; i++) {
            handled = this.children[i].handleMessage(msg);
            if (handled) {
                break;
            }
        }
        if(handled) { 
            this.debugMIDI(string + " handled"); 
        } else { 
            this.debugMIDI(string + " ignored");
        }
    }
}

registerController (new KORGnanoKONTROL2());
