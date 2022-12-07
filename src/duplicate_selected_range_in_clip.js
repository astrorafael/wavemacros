// This macro inserts a leading clip with some clicks and
// pads the rest of tracks with an empty space, then renders all clips per track
// Usage: 
//   1. Select a range with the mouse.
//   2. then select the clip containing the click track. 
//   3. execute the macro.

function pasteClip(clip, start, end)
{
    Tracktion.log("Pasting clip " + clip + " starting at " + start);
    Tracktion.deselectAll();
    Tracktion.addObjectsToSelection(clip);
    Tracktion.copy();
    Tracktion.insertSpaceIntoEdit (start, end - start); // for all tracks
    Tracktion.paste();
    Tracktion.setPosition ('cursor', start);
    Tracktion.moveStartOfSelectedClipsToCursor();
    var trclips = Tracktion.getClipsFromTracks (Tracktion.getTrackFromSelectedObject());
    var seclips = Tracktion.getSelectedEditElements ('clip');
    Tracktion.log("After pasting, there are " + seclips.length + " selected clips out of " + trclips.length);
}

function splitMarkedRegion(old_method)
{
    var start = Tracktion.getPosition ('markIn');
    var end   = Tracktion.getPosition ('markOut');
    if ( ! old_method) {
        Tracktion.log("Using API split method");
        Tracktion.splitMarkedRegion();
    } else {
        Tracktion.log("Using old split method");
        Tracktion.setPosition ('cursor', start);
        Tracktion.splitClips();
        Tracktion.setPosition ('cursor', end);
        Tracktion.splitClips();
        Tracktion.log("Selected Region: start = " + start + ", end = " + end);
    }
    return [start, end];
}

function duplicateSelectedRegion()
{
    var clips   = Tracktion.getSelectedEditElements ('clip');
    if (clips.length == 0) {
        Tracktion.showMessage('No clips selected');
        return;
    }
    Tracktion.log("========================================");
    var clickTrack = Tracktion.getTrackFromSelectedObject();
    var clickTrackName = Tracktion.getName(clickTrack);
    var marks = splitMarkedRegion(true);
    var start = marks[0];
    var end   = marks[1];
    clips = Tracktion.getClipsFromTracks (clickTrack);
    Tracktion.log("Click Track has " + clips.length + " clips selected.");
    var index = 0;
    if (clips.length == 3) {
        index = 1;
    }
    pasteClip(clips[index], start, end);
}

duplicateSelectedRegion();
