// This macro inserts a leading clip with some clicks and
// pads the rest of tracks with an empty space, then renders all clips per track
// Usage: 
// 1. Select a range 
// 2. then select the clip containing the click track 
// 3. execute the macro


function pasteClip(clip, start, end)
{
    Tracktion.log("Pasting clip " + clip + " starting at " + start);
    Tracktion.deselectAll();
    Tracktion.addObjectsToSelection(clip);
    Tracktion.copy();
    Tracktion.insertSpaceIntoEdit (start, end - start);
    Tracktion.paste();
    Tracktion.setPosition ('cursor', start);
    Tracktion.moveStartOfSelectedClipsToCursor();
    var trclips = Tracktion.getClipsFromTracks (Tracktion.getTrackFromSelectedObject());
    var seclips = Tracktion.getSelectedEditElements ('clip');
    Tracktion.log("After pasting, there are " + seclips.length + " selected clips out of " + trclips.length);
}

function padOtherTracksThan(trackName, start)
{
    var tracks = Tracktion.getEditElements ('track');
    var name = null;
    for(var t = 0; t < tracks.length; ++t ) {
        //Tracktion.log("Comparing Track[" + t + "] name  (" + name + ") con track name (" + trackName + ")");
        name = Tracktion.getName(tracks[t]);
        if (name !== trackName) {
            Tracktion.deselectAll();
            Tracktion.addObjectsToSelection(tracks[t]);
            Tracktion.setPosition ('cursor', start);
            Tracktion.insertClip ('wave');
        }
    }
}

function logTrack(track, i, clips)
{
    name = Tracktion.getName(track);
    Tracktion.log("Track[" + i + "] = " + name + " has " + clips.length + " clips");
}

function mergeAllClips()
{
    var tracks = Tracktion.getEditElements ('track');
    Tracktion.deselectAll();
    Tracktion.log("found " + tracks.length + " tracks");
    for(var t = 0; t < tracks.length; ++t ) {
        var clips = Tracktion.getClipsFromTracks (tracks[t]);
        logTrack(tracks[t], t, clips);
        for(var c = 0; c < clips.length; ++c ) {
            Tracktion.addObjectsToSelection(clips[c]);
        } 
    }
    // Even though we have selected all clips, merge processing is per track
    Tracktion.mergeSelectedClips (true);
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

function duplicateLeadingClickTrackBar()
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
    padOtherTracksThan(clickTrackName, start);
    mergeAllClips();
}
duplicateLeadingClickTrackBar();
