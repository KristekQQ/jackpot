<GameFile>
  <PropertyGroup Name="display_bg" Type="Node" ID="6914f5d9-3f8f-46cd-b9a9-17bf9932e8f1" Version="3.10.0.0" />
  <Content ctype="GameProjectContent">
    <Content>
      <Animation Duration="3" Speed="1.0000">
        <Timeline ActionTag="2458141" Property="Position">
          <PointFrame FrameIndex="0" Tween="False" X="-395.0000" Y="95.0000" />
          <PointFrame FrameIndex="3" X="-395.0000" Y="95.0000">
            <EasingData Type="0" />
          </PointFrame>
        </Timeline>
        <Timeline ActionTag="2458141" Property="RotationSkew">
          <ScaleFrame FrameIndex="0" Tween="False" X="0.0000" Y="0.0000" />
          <ScaleFrame FrameIndex="3" X="0.0000" Y="0.0000">
            <EasingData Type="0" />
          </ScaleFrame>
        </Timeline>
        <Timeline ActionTag="2458141" Property="Alpha">
          <IntFrame FrameIndex="0" Tween="False" Value="255" />
          <IntFrame FrameIndex="3" Value="255">
            <EasingData Type="0" />
          </IntFrame>
        </Timeline>
        <Timeline ActionTag="2458141" Property="Scale">
          <ScaleFrame FrameIndex="0" Tween="False" X="1.0000" Y="1.0000" />
          <ScaleFrame FrameIndex="3" X="1.0000" Y="1.0000">
            <EasingData Type="0" />
          </ScaleFrame>
        </Timeline>
        <Timeline ActionTag="2458141" Property="FileData">
          <TextureFrame FrameIndex="0" Tween="False">
            <TextureFile Type="PlistSubImage" Path="display_bg_gold.png" Plist="_bitmaps/game_jackpot1.plist" />
          </TextureFrame>
          <TextureFrame FrameIndex="1" Tween="False">
            <TextureFile Type="PlistSubImage" Path="display_bg_silver.png" Plist="_bitmaps/game_jackpot1.plist" />
          </TextureFrame>
          <TextureFrame FrameIndex="2" Tween="False">
            <TextureFile Type="PlistSubImage" Path="display_bg_bronze.png" Plist="_bitmaps/game_jackpot1.plist" />
          </TextureFrame>
          <TextureFrame FrameIndex="3" Tween="False">
            <TextureFile Type="PlistSubImage" Path="display_bg_univerzal.png" Plist="_bitmaps/game_jackpot1.plist" />
          </TextureFrame>
        </Timeline>
        <Timeline ActionTag="2458141" Property="AnchorPoint">
          <ScaleFrame FrameIndex="0" Tween="False" X="0.0000" Y="1.0000" />
          <ScaleFrame FrameIndex="3" X="0.0000" Y="1.0000">
            <EasingData Type="0" />
          </ScaleFrame>
        </Timeline>
        <Timeline ActionTag="2458141" Property="CColor">
          <ColorFrame FrameIndex="0" Alpha="255">
            <EasingData Type="0" />
            <Color A="255" R="255" G="255" B="255" />
          </ColorFrame>
        </Timeline>
        <Timeline ActionTag="2458141" Property="VisibleForFrame">
          <BoolFrame FrameIndex="0" Tween="False" Value="True" />
        </Timeline>
        <Timeline ActionTag="-1338976495" Property="VisibleForFrame">
          <BoolFrame FrameIndex="0" Tween="False" Value="False" />
          <BoolFrame FrameIndex="1" Tween="False" Value="False" />
          <BoolFrame FrameIndex="2" Tween="False" Value="False" />
          <BoolFrame FrameIndex="3" Tween="False" Value="True" />
        </Timeline>
      </Animation>
      <AnimationList>
        <AnimationInfo Name="GOLD" StartIndex="0" EndIndex="0">
          <RenderColor A="255" R="135" G="0" B="0" />
        </AnimationInfo>
        <AnimationInfo Name="SILVER" StartIndex="1" EndIndex="1">
          <RenderColor A="255" R="180" G="0" B="0" />
        </AnimationInfo>
        <AnimationInfo Name="BRONZE" StartIndex="2" EndIndex="2">
          <RenderColor A="255" R="225" G="0" B="0" />
        </AnimationInfo>
        <AnimationInfo Name="UNIVERZAL" StartIndex="3" EndIndex="3">
          <RenderColor A="255" R="15" G="0" B="0" />
        </AnimationInfo>
      </AnimationList>
      <ObjectData Name="animation/sprites/display_bg" Tag="1" ctype="GameNodeObjectData">
        <Size X="0.0000" Y="0.0000" />
        <Children>
          <AbstractNodeData Name="Layer_2" ActionTag="2458141" Tag="2458151" IconVisible="False" LeftMargin="-395.0000" RightMargin="-397.0000" TopMargin="-95.0000" BottomMargin="-93.0000" ctype="SpriteObjectData">
            <Size X="792.0000" Y="188.0000" />
            <AnchorPoint ScaleY="1.0000" />
            <Position X="-395.0000" Y="95.0000" />
            <Scale ScaleX="1.0000" ScaleY="1.0000" />
            <CColor A="255" R="255" G="255" B="255" />
            <PrePosition />
            <PreSize X="0.0000" Y="0.0000" />
            <FileData Type="PlistSubImage" Path="display_bg_univerzal.png" Plist="_bitmaps/game_jackpot1.plist" />
            <BlendFunc Src="1" Dst="771" />
          </AbstractNodeData>
          <AbstractNodeData Name="text" ActionTag="-1338976495" Tag="3" IconVisible="False" LeftMargin="-120.0000" RightMargin="-120.0000" TopMargin="-77.0000" BottomMargin="47.0000" IsCustomSize="True" FontSize="26" LabelText="txt" HorizontalAlignmentType="HT_Center" VerticalAlignmentType="VT_Bottom" ShadowOffsetX="2.0000" ShadowOffsetY="-2.0000" ctype="TextObjectData">
            <Size X="240.0000" Y="30.0000" />
            <AnchorPoint ScaleX="0.5000" ScaleY="0.5000" />
            <Position Y="62.0000" />
            <Scale ScaleX="1.0000" ScaleY="1.0000" />
            <CColor A="255" R="255" G="255" B="255" />
            <PrePosition />
            <PreSize X="0.0000" Y="0.0000" />
            <OutlineColor A="255" R="255" G="0" B="0" />
            <ShadowColor A="255" R="110" G="110" B="110" />
          </AbstractNodeData>
        </Children>
      </ObjectData>
    </Content>
  </Content>
</GameFile>