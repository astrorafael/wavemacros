/*
    KORG nanoKONTROL2
*/

const VERSION = "0.1.0";

// -----
// DEBUG
// -----

// 0x01 - Main Controller
// 0x02 - Channel Strip Controller
// 0x04 - Track & Loop Controller
// 0x08 - Marker Controller
// 0x10 - Transport Controller
const DEBUG = 0x00;

// =====================================
// BUTTON DEFINITIONS IN CUBASE DAW MODE
// =====================================

// type of human interface element
const SLIDER  = 0xe0;
const BUTTON  = 0x90;
const PANPOT  = 0xb0;

// =========================================================================================== //
//                                     CHANNEL STRIP CLASS                                     //
// =========================================================================================== //


function ChannelStripController(channel, parent)
{

    // Kind of buttons
    const ARM_REC_BUTTON = 0x00;
    const SOLO_BUTTON    = 0x08;
    const MUTE_BUTTON    = 0x10;

    this.solo    = false;
    this.arm     = false;
    this.mute    = false;
    this.parent  = parent;
    this.channel = channel; // Always from 0 to 7
    this.track   = channel; // Assume faderBank 0 at the very beginning

    // Debugging aid
    this.debugMsg = function(msg) {
        const DEBUG_MODULE = 0x02;
        if (DEBUG & DEBUG_MODULE ) {
            logMsg(msg);
        }
    }

    this.debugMsg("Creating channel strip [" + channel + "]");

    this.onFaderBankChanged = function(bank) {
        this.track = bank + this.channel
        //logMsg("Track changed to " + this.track + " in bank " + bank);
    }

    // soloLit         = 1,    Track is explicitly soloed. 
    // soloFlashing    = 2,    Track is implicitly soloed. 
    // soloIsolate     = 4,    Track is explicitly solo isolated. 
    // muteLit         = 8,    Track is explicitly muted.
    // muteFlashing    = 16    Track is implicitly muted.
    this.onSoloMuteChanged = function (muteAndSoloLightState, isBright) {
        //this.debugMsg("onSoloMuteChanged [" + this.channel + "] = " + muteAndSoloLightState);
        this.mute = ((muteAndSoloLightState & (8 | 16))    != 0 );
        this.solo = ((muteAndSoloLightState & (1 | 2 | 4)) != 0 );
        this.parent.lightUpButton(SOLO_BUTTON + this.channel, this.solo);
        this.parent.lightUpButton(MUTE_BUTTON + this.channel, this.mute);
    }

    this.onTrackRecordEnabled = function(isEnabled) { 
        //this.debugMsg("onTrackRecordEnabled = " + isEnabled);
        this.arm = isEnabled;
        this.parent.lightUpButton(ARM_REC_BUTTON + this.channel, this.arm);
    }
    
    this.handleMessage = function (msg) {
        var header = msg[0] & 0xf0;
        var type   = msg[1] & 0xf8;
        var channel= msg[1] & 0x07;
        var value  = msg[2];
        var handled = false;
        if((header == BUTTON) && (channel == this.channel) && (value != 0)) {
            if (type == SOLO_BUTTON) {
                this.debugMsg("Pressed SOLO button [" + channel + "](" + this.track + ")");
                this.solo = !this.solo;
                this.parent.lightUpButton(SOLO_BUTTON + channel, this.solo);
                toggleSolo (this.track);         // Call Waveform API
                selectPluginInTrack(this.track); // Call Waveform API
                handled = true;
            } else if (type == MUTE_BUTTON) {
                this.debugMsg("Pressed MUTE button [" + channel + "](" + this.track + ")");
                this.mute = !this.mute;
                this.parent.lightUpButton(MUTE_BUTTON + channel, this.mute);
                toggleMute (this.track);         // Call Waveform API
                selectPluginInTrack(this.track); // Call Waveform API
                handled = true;
            } else if (type == ARM_REC_BUTTON) {
                this.debugMsg("Pressed ARM REC button [" + channel + "](" + this.track + ")");
                this.arm = !this.arm;
                this.parent.lightUpButton(ARM_REC_BUTTON + channel, this.arm);
                toggleRecEnable (this.track, false); // Call Waveform API
                selectPluginInTrack(this.track);     // Call Waveform API
                handled = true;  
            }
        } else if ((header == SLIDER) && ((msg[0] & 0x07) == this.channel)) {
            this.debugMsg("Moving Slider [" + this.channel + "](" + this.track + ")");
            setFader (this.track, value / 127, false); // Call Waveform API
            selectPluginInTrack(this.track);           // Call Waveform API
            handled = true;
         } else if ((header == PANPOT) && (channel == this.channel)) {
            var increment = value & 0x40 ? -(value & 0x3F) : (value & 0x3F);
            this.debugMsg("Turning Panpot [" + channel + "](" + this.track + ") =" + increment);
            setPanPot (this.track, increment/64, true); // Call Waveform API
            selectPluginInTrack(this.track);            // Call Waveform API
            handled = true;
        }
        return handled;
    }
}

// =========================================================================================== //
//                             FADER BANK AND LOOP CONTROL CLASS                               //
// =========================================================================================== //


function FaderBankController(parent)
{

    // Kind of buttons
    const TRACK_LEFT_BUTTON  = 0x2e;
    const TRACK_RIGHT_BUTTON = 0x2f;
    const CYCLE_BUTTON       = 0x56;

    this.parent = parent;
    this.loop   = false;

    // Debugging aid
    this.debugMsg = function(msg) {
        const DEBUG_MODULE = 0x04;
        if (DEBUG & DEBUG_MODULE) {
            logMsg(msg);
        }
    }
    
    this.debugMsg("Creating Fader Banks & Loop controller");

    this.onLoopChanged = function (flag) {
        this.loop   = flag;
        this.parent.lightUpButton(CYCLE_BUTTON, this.loop);
    }

    this.handleMessage = function (msg) {
        var header = msg[0] & 0xf0;
        var type   = msg[1]
        var value  = msg[2];
        var handled = false;
        if ((header == BUTTON) && (type == TRACK_LEFT_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed TRACK LEFT button [" + TRACK_LEFT_BUTTON.toString(16) + "]");
            changeFaderBanks (-this.parent.numberOfFaderChannels); // call Tracktion API
            handled = true;
        } else if ((header == BUTTON) && (type == TRACK_RIGHT_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed TRACK RIGHT button [" + TRACK_RIGHT_BUTTON.toString(16) + "]");
            changeFaderBanks (this.parent.numberOfFaderChannels); // call Tracktion API
            handled = true;
        } else if ((header == BUTTON) && (type == CYCLE_BUTTON) && (value == 0x7f)) {
             this.debugMsg("Pressed CYCLE button [" + CYCLE_BUTTON.toString(16) + "]");
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

    // Kind of buttons
    const MARKER_SET_BUTTON  = 0x59;
    const MARKER_NEXT_BUTTON = 0x5a;
    const MARKER_PREV_BUTTON = 0x58;

    this.parent = parent;

    // Debugging aid
    this.debugMsg = function(msg) {
        const DEBUG_MODULE = 0x08;
        if (DEBUG & DEBUG_MODULE) {
            logMsg(msg);
        }
    }
    
    this.debugMsg("Creating Markers controller");

    this.handleMessage = function (msg) {
        var header = msg[0] & 0xf0;
        var type   = msg[1]
        var value  = msg[2];
        var handled = false;
        if ((header == BUTTON) && (type == MARKER_PREV_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed MARKER PREV button [" + MARKER_PREV_BUTTON.toString(16) + "]");
            gotoPreviousMarker(); // Call Tracktion API
            handled = true;
        } else if ((header == BUTTON) && (type == MARKER_NEXT_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed MARKER NEXT button [" + MARKER_NEXT_BUTTON.toString(16) + "]");
            gotoNextMarker(); // Call Tracktion API
            handled = true;
        } else if ((header == BUTTON) && (type == MARKER_SET_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed MARKER SET button [" + MARKER_SET_BUTTON.toString(16) + "]");
            createMarker(); // Call Tracktion API
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

    // Kind of buttons
    const REW_BUTTON    = 0x5b;
    const FF_BUTTON     = 0x5c;
    const STOP_BUTTON   = 0x5d;
    const PLAY_BUTTON   = 0x5e;
    const RECORD_BUTTON = 0x5f;

    this.parent = parent;

    // Debugging aid
    this.debugMsg = function(msg) {
        const DEBUG_MODULE = 0x10;
        if (DEBUG & DEBUG_MODULE) {
            logMsg(msg);
        }
    }
    
    this.debugMsg("Creating Transport controller");

    // tells the device that playback has stopped or started, and it should turn its lights on accordingly.
    this.onPlayStateChanged = function(isPlaying) {  
        this.debugMsg("onPlayStateChanged(" + isPlaying +")");
        this.parent.lightUpButton(STOP_BUTTON, ! isPlaying);
        this.parent.lightUpButton(PLAY_BUTTON,  isPlaying);
    }

    this.onRecordStateChanged = function(isRecording) {
        this.debugMsg("onRecordStateChanged(" + isRecording + ")");  
        this.parent.lightUpButton(RECORD_BUTTON, isRecording);
    }

    this.handleMessage = function (msg) {
        var header = msg[0] & 0xf0;
        var type   = msg[1]
        var value  = msg[2];
        var handled = false;
        if ((header == BUTTON) && (type == REW_BUTTON)) {
            this.debugMsg("Pressed REW button [" + REW_BUTTON.toString(16) + "]");
            // gotoStart(); 
            rewind (value == 0x7f);
            this.parent.lightUpButton(REW_BUTTON, value == 0x7f);
            handled = true;
        } else if ((header == BUTTON) && (type == FF_BUTTON)) {
            this.debugMsg("Pressed FF button [" + FF_BUTTON.toString(16) + "]");
            // gotoEnd();
            fastForward (value == 0x7f);
            this.parent.lightUpButton(FF_BUTTON, value == 0x7f);
            handled = true;
        } else if ((header == BUTTON) && (type == STOP_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed STOP button [" + STOP_BUTTON.toString(16) + "]");
            stop(); // Call Tracktion API
            this.parent.lightUpButton(STOP_BUTTON, true);
            this.parent.lightUpButton(PLAY_BUTTON, false);
            handled = true;
        } else if ((header == BUTTON) && (type == PLAY_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed PLAY button [" + PLAY_BUTTON.toString(16) + "]");
            play();         // Call Tracktion API
            handled = true;
        } else if ((header == BUTTON) && (type == RECORD_BUTTON) && (value == 0x7f)) {
            this.debugMsg("Pressed RECORD button [" + RECORD_BUTTON.toString(16) + "]");
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
    // Variables: these must be filled out so the session knows your controller layout
   this.deviceDescription               = "Korg nanoKONTROL 2";        // device name
    this.needsMidiChannel                = true;                        // send midi controller to daw
    this.needsMidiBackChannel            = true;                        // send midi daw to controller
    this.midiChannelName                 = "nanoKONTROL2 SLIDER/KNOB";  // MIDI channel name
    this.midiBackChannelName             = "nanoKONTROL2 CTRL";         // MIDI channel name
    this.numberOfFaderChannels           = 8;                           // number physical faders      
    this.wantsClock                      = false;                       // device wants MIDI clock
    this.allowBankingOffEnd              = true;                        // allow surface to display blank channels
    this.pickUpMode                      = true;                        // set true for non motorized faders
    this.notes                           = "Set 'LED Mode' = 'External' using Korg Kontrol Editor to enable light up buttons";
    this.needsOSCSocket                  = false;                    // communicate via osc
    this.numCharactersForTrackNames      = 0;                        // characters of channel text
    this.numCharactersForAuxLabels       = 0;                        // characters of aux text
    this.numParameterControls            = 0;                        // number of labelled rotary dials that can control things like plugin parameters
    this.numCharactersForParameterLabels = 0;                        // characters for rotary dials
    this.numMarkers                      = 0;                        // number of markers that can be displayed
    this.numCharactersForMarkerLabels    = 0;                        // characters for markers
    this.wantsAuxBanks                   = false;                    // display auxes
    this.numAuxes                        = 0;                        // number of auxes that can be displayed
    this.followsTrackSelection           = false;                    // controller track follows UI selection
    // Private variables
    this.children                        = new Array();
    this.channelStrip                    = new Array();
    this.bankController                  = null;
    this.markersController               = null;
    this.transport                       = null;

    // Debugging aid
    this.debugMsg = function(msg) {
        const DEBUG_MODULE = 0x01;
        if (DEBUG & DEBUG_MODULE ) {
            logMsg(msg);
        }
    }

    // Called once at startup. 
    this.initialise = function() {
        logMsg("KORG nanoKONTROL 2 Controller, version " + VERSION);
        logMsg("Working in Cubase DAW mode: <SET> + <REW>");
        this.bankController    = new FaderBankController(this);
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
    }

    // Called at startup or any time the midi or osc ports change.
    // You may now be talking to a new physical device now, time to
    // initialise the hardware again
    this.initialiseDevice = function() {  
        this.debugMsg("Initializing device");
    }

    // Called at shutdown
    this.shutDownDevice = function() { 
        this.debugMsg("Shutting down device");       
    }

    // Lights up a given button
    this.lightUpButton = function(buttonNum, on) {
        var value = on ? 0x7f : 0x00;
        this.debugMsg("MIDI OUT ==> [0x" + BUTTON.toString(16) + ", 0x" + buttonNum.toString(16) + ", 0x" + value.toString(16) + "]");
        sendMidiToDevice ([BUTTON, buttonNum, value]);
    }

    // tells the device that looping has been turned on or off.
    this.onLoopChanged = function(isLoopOn) {  
        this.bankController.onLoopChanged(isLoopOn);  
    }

    this.onSoloMuteChanged = function(channel, muteAndSoloLightState, isBright) {
        this.channelStrip[channel].onSoloMuteChanged(muteAndSoloLightState, isBright);
    }

    this.onTrackRecordEnabled = function(channel, isEnabled) { 
        this.channelStrip[channel].onTrackRecordEnabled(isEnabled);  
    }

    this.onFaderBankChanged = function(bank) {
        this.debugMsg("Fader bank changed [" + bank + "]");
        for (var i = 0; i < this.numberOfFaderChannels; i++) {
            this.channelStrip[i].onFaderBankChanged(bank);
        }
    }
   
    this.onPlayStateChanged = function(isPlaying) {    
        this.transport.onPlayStateChanged(isPlaying);
    }

    this.onRecordStateChanged = function(isRecording) {
        this.transport.onRecordStateChanged(isRecording);
    }


    // Called when a midi message comes in from the controller. You must
    //  translate this and call methods in the session accordingly to
    // trigger whatever action the user is trying to do.
    this.onMidiReceivedFromDevice = function(msg) {
        this.debugMsg("MIDI IN  <== [0x" + msg[0].toString(16) + ", 0x" + msg[1].toString(16) + ", 0x" + msg[2].toString(16) + "]");
        var handled = false;
        for(var i=0; i < this.children.length; ++i) {
            handled = this.children[i].handleMessage(msg);
            if (handled) {
                break;
            }
        }
    }
}

registerController (new KORGnanoKONTROL2());
