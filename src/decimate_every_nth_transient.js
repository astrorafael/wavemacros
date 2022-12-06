// ---------------------------------------------------
// Decimates a click track pulses every 'beatsPerBar'
// User must select the clip to be decimated.
// Only one clip must be selected.
// --------------------------------------------------

var decimationFactor = 4;     // usually 4 in 99% of the use cases
var offset           = 0;     // from 0 to decimationFactor-1
var inverted         = false; // inverted decimation condition

function removeSilence(track)
{
    Tracktion.removeSilence(true);
    return Tracktion.getClipsFromTracks (track);
}

function mergeClips(track, clips) {
    Tracktion.deselectAll();
    Tracktion.addObjectsToSelection(clips);
    Tracktion.mergeSelectedClips();
    return Tracktion.getClipsFromTracks (track);
}

function decimateClips(track, clips, N, offset, inverted) {
    Tracktion.deselectAll();
    for (var c = 0; c < clips.length; ++c) {
        var modulus = (c + N - offset) % N;
        if ( ! inverted && modulus != 0) {
            Tracktion.addObjectsToSelection (clips[c]);
        } else if (inverted && modulus == 0) {
            Tracktion.addObjectsToSelection (clips[c]);
        }
    }
    Tracktion.deleteSelected();
    return Tracktion.getClipsFromTracks (track);
}   


function decimateClipTransientsEvery(N, offset)
{
    var clips = Tracktion.getSelectedEditElements ('clip');
    var track = Tracktion.getTrackFromSelectedObject();

    if (clips === null) {
        Tracktion.showMessage('No clip selected');
        return;
    }
    if (clips.length > 1) {
        Tracktion.showMessage('Too many clips selected');
        return false;
    }
    var track = Tracktion.getTrackFromSelectedObject();
    var name = (inverted ? 'upbeats' : 'downbeats');
    Tracktion.setName (track, name);   // name track depending on condition
    clips = removeSilence(track);
    clips = Tracktion.getClipsFromTracks (track);
    clips = decimateClips(track, clips, N, offset, inverted);
    clips = mergeClips(track, clips);
    Tracktion.setName (clips[0], name);   // final clip name
}

decimateClipTransientsEvery(decimationFactor, offset, inverted);

