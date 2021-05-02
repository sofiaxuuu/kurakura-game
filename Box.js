import React, {Component} from "react"; 
import { View } from "react-native"; // Box.js will render a View that has styling on it to make it look like a box.
import { array, object, string } from 'prop-types'; // Box.js will take those props and use them to help style itself depending on what values are passed into the Box component.

export default class Box extends Component {
    render() {
        const width = this.props.size[0]; //? size[0] 
        const height = this.props.size[1];
        const x = this.props.body.position.x - width / 2; //? props 
        const y = this.props.body.position.y - height / 2;

        return (
            <View
              style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: width,
                  height: height,
                  backgroundColor: this.props.color || "pink"
                }}/>
          );
    }
}

Box.propTypes = {
    size: array,
    body: object, 
    color: string
} //? 
