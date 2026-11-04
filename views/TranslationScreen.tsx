import ParallaxScrollView from "@/components/ParallaxScrollView";
import useTrackHistory from "@/hooks/useTrackHistory";

export default function TranslationScreen() {
    useTrackHistory('/(authenticated)/translation');
    return (
        <ParallaxScrollView>
        </ParallaxScrollView>
    )
}