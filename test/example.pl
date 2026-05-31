#!/usr/bin/perl
# Perl example — Code Scavenge test file
use strict;
use warnings;

package MathUtils;

sub clamp {
    my ($value, $min, $max) = @_;
    return $value < $min ? $min : $value > $max ? $max : $value;
}

sub lerp {
    my ($a, $b, $t) = @_;
    return $a + ($b - $a) * $t;
}

sub slugify {
    my ($str) = @_;
    $str = lc $str;
    $str =~ s/[^a-z0-9]+/-/g;
    return $str;
}

package Vec2;

sub new {
    my ($class, $x, $y) = @_;
    return bless { x => $x // 0.0, y => $y // 0.0 }, $class;
}

sub add {
    my ($self, $other) = @_;
    return Vec2->new($self->{x} + $other->{x}, $self->{y} + $other->{y});
}

sub scale {
    my ($self, $s) = @_;
    return Vec2->new($self->{x} * $s, $self->{y} * $s);
}

sub dot {
    my ($self, $other) = @_;
    return $self->{x} * $other->{x} + $self->{y} * $other->{y};
}

sub length {
    my ($self) = @_;
    return sqrt($self->{x}**2 + $self->{y}**2);
}

sub to_string {
    my ($self) = @_;
    return "($self->{x}, $self->{y})";
}

package EventEmitter;

sub new {
    my ($class) = @_;
    return bless { listeners => {} }, $class;
}

sub on {
    my ($self, $event, $handler) = @_;
    push @{$self->{listeners}{$event}}, $handler;
}

sub emit {
    my ($self, $event, @args) = @_;
    for my $handler (@{$self->{listeners}{$event} // []}) {
        $handler->(@args);
    }
}

1;
