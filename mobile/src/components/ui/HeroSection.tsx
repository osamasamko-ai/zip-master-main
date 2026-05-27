import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';

interface HeroSectionProps {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    kicker?: string;
    title: string;
    subtitle?: string | React.ReactNode;
    rightElement?: React.ReactNode;
    children?: React.ReactNode;
    style?: ViewStyle;
    refreshing?: boolean;
}

export function HeroSection({
    icon,
    iconColor = colors.gold,
    kicker,
    title,
    subtitle,
    rightElement,
    children,
    style,
    refreshing = false,
}: HeroSectionProps) {
    return (
        <View style={[styles.hero, style]}>
            <View style={styles.heroTop}>
                <View style={styles.heroIcon}>
                    {refreshing ? (
                        <ActivityIndicator size="small" color={iconColor} />
                    ) : (
                        <Ionicons name={icon} size={22} color={iconColor} />
                    )}
                </View>
                <View style={styles.flex}>
                    {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
                    <Text style={styles.title}>{title}</Text>
                    {typeof subtitle === 'string' ? (
                        <Text style={styles.subtitle}>{subtitle}</Text>
                    ) : (
                        subtitle
                    )}
                </View>
                {rightElement}
            </View>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    hero: {
        backgroundColor: colors.paper,
        borderColor: colors.line,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 2,
        marginBottom: 12,
        padding: 14,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 20,
    },
    heroIcon: {
        alignItems: 'center',
        backgroundColor: colors.navy,
        borderRadius: 12,
        height: 44,
        justifyContent: 'center',
        width: 44,
        shadowColor: colors.navy,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    heroTop: {
        alignItems: 'center',
        flexDirection: 'row-reverse',
        gap: 12,
    },
    kicker: { color: colors.gold, fontSize: 11, fontWeight: '900', textAlign: 'right' },
    subtitle: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 21, marginTop: 5, textAlign: 'right' },
    title: { color: colors.ink, fontSize: 25, fontWeight: '900', textAlign: 'right' },
});